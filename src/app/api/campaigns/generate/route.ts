import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import {
  generateGoogleAdsCampaign,
  generateMetaAdsCampaign,
  generateLinkedInAdsCampaign,
  generateYouTubeAdsCampaign,
  generateEcommerceStrategy,
} from '@/lib/ai/engine'
import { generateDemandGenCampaign, generatePerformanceMaxCampaign } from '@/lib/ai/demandgen'
import { createMockCampaignData } from '@/lib/ai/mock-data'
import { PLAN_PREVIEW_COOKIE } from '@/lib/subscription/preview'
import { getServerEffectivePlan, isTestSubscriptionModeEnabled } from '@/lib/subscription/test-mode'
import type { GenerateCampaignInput, Platform } from '@/types'

type GeneratorFn = (input: GenerateCampaignInput) => Promise<Record<string, unknown>>

const GENERATORS: Partial<Record<Platform, GeneratorFn>> = {
  google: generateGoogleAdsCampaign,
  meta: generateMetaAdsCampaign,
  linkedin: generateLinkedInAdsCampaign,
  youtube: generateYouTubeAdsCampaign,
  shopping: generateEcommerceStrategy,
  demand_gen: generateDemandGenCampaign,
  performance_max: generatePerformanceMaxCampaign,
}

const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google Search',
  meta: 'Meta (Facebook/Instagram)',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  shopping: 'Google Shopping',
  demand_gen: 'Demand Gen',
  performance_max: 'Performance Max',
}

const PLATFORM_ALIASES: Record<string, Platform> = {
  google: 'google',
  google_ads: 'google',
  google_search: 'google',
  google_search_ads: 'google',
  meta: 'meta',
  meta_ads: 'meta',
  facebook: 'meta',
  facebook_ads: 'meta',
  instagram: 'meta',
  linkedin: 'linkedin',
  linkedin_ads: 'linkedin',
  youtube: 'youtube',
  youtube_ads: 'youtube',
  shopping: 'shopping',
  google_shopping: 'shopping',
  demand_gen: 'demand_gen',
  demandgen: 'demand_gen',
  performance_max: 'performance_max',
  pmax: 'performance_max',
}

function normalizePlatform(value: unknown): Platform | null {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return PLATFORM_ALIASES[normalized] || null
}

function normalizePlatforms(values: unknown[]): Platform[] {
  const platforms = values.map(normalizePlatform).filter(Boolean) as Platform[]
  return [...new Set(platforms)]
}

export async function POST(request: NextRequest) {
  try {
    const { project_id, platform } = await request.json()
    const previewCookie = request.cookies.get(PLAN_PREVIEW_COOKIE)?.value
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: project } = await adminClient
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .single()

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    if (!project.business_analysis) {
      return NextResponse.json({ error: 'Run analysis first' }, { status: 400 })
    }

    const { data: subscription } = await adminClient
      .from('subscriptions')
      .select('plan')
      .eq('user_id', user.id)
      .single()

    // Some older projects/deployments may have stored display labels like
    // "Google Ads"; normalize before choosing the generator and DB payload.
    const platformsToGenerate = normalizePlatforms(
      platform ? [platform] : Array.isArray(project.platforms) ? project.platforms : []
    )

    if (platformsToGenerate.length === 0) {
      return NextResponse.json(
        { error: 'No supported advertising platform selected for this project' },
        { status: 400 }
      )
    }

    if (!platform && JSON.stringify(platformsToGenerate) !== JSON.stringify(project.platforms || [])) {
      await adminClient
        .from('projects')
        .update({ platforms: platformsToGenerate, updated_at: new Date().toISOString() })
        .eq('id', project_id)
        .eq('user_id', user.id)
    }

    const freePlatforms: Platform[] = ['google', 'meta']
    const effectivePlan = getServerEffectivePlan(subscription?.plan, previewCookie)
    const blockedPlatform = effectivePlan === 'free'
      ? platformsToGenerate.find((value) => !freePlatforms.includes(value))
      : null

    if (blockedPlatform) {
      return NextResponse.json(
        { error: `${PLATFORM_LABELS[blockedPlatform] || blockedPlatform} requires Pro plan` },
        { status: 403 }
      )
    }

    const input: GenerateCampaignInput = {
      project_id,
      platform: platformsToGenerate[0],
      business_analysis: project.business_analysis,
      competitor_analysis: project.competitor_analysis,
      campaign_strategy: project.campaign_strategy,
      monthly_budget: project.monthly_budget,
    }

    const results = []

    for (const currentPlatform of platformsToGenerate) {
      const generator = GENERATORS[currentPlatform]
      if (!generator) continue

      // Test mode uses deterministic sample campaign data so Vercel Preview can
      // test the campaign UI without requiring working AI provider keys.
      const generated = isTestSubscriptionModeEnabled()
        ? createMockCampaignData(currentPlatform, project)
        : await generator({ ...input, platform: currentPlatform })

      const campaignName = `${project.business_analysis.company_name} - ${PLATFORM_LABELS[currentPlatform] || currentPlatform}`
      const objective = (generated.structure as Record<string, unknown>)?.campaign_objective as string || 'Conversions'
      const campaignPayload = {
        project_id,
        user_id: user.id,
        platform: currentPlatform,
        name: campaignName,
        objective,
        status: 'ready',
        structure: generated.structure || null,
        settings: generated.settings || null,
        ad_copy: generated.ad_copy || null,
        keywords: generated.keywords || null,
        audiences: generated.audiences || null,
        creatives: generated.creatives || null,
      }

      const { data: existingCampaigns } = await adminClient
        .from('campaigns')
        .select('id')
        .eq('project_id', project_id)
        .eq('user_id', user.id)
        .eq('platform', currentPlatform)
        .order('created_at', { ascending: false })
        .limit(1)

      const existingCampaign = existingCampaigns?.[0]

      const query = existingCampaign?.id
        ? adminClient.from('campaigns').update(campaignPayload).eq('id', existingCampaign.id)
        : adminClient.from('campaigns').insert(campaignPayload)

      const { data: campaign, error: campaignError } = await query.select().single()
      if (campaignError) throw new Error(campaignError.message)

      results.push(campaign)
    }

    if (results.length === 0) {
      return NextResponse.json(
        { error: 'No campaigns were generated. Please check the selected platforms and try again.' },
        { status: 500 }
      )
    }

    await adminClient.from('usage_logs').insert({
      user_id: user.id,
      action: 'campaign_generated',
      metadata: { project_id, platforms: platformsToGenerate },
      tokens_used: isTestSubscriptionModeEnabled() ? 0 : 4000 * platformsToGenerate.length,
    })

    return NextResponse.json({ success: true, campaigns: results })
  } catch (error) {
    console.error('Campaign generation error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Generation failed' }, { status: 500 })
  }
}
