import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import {
  analyzeWebsite,
  analyzeCompetitors,
  generateCampaignStrategy,
  generateForecasts,
} from '@/lib/ai/engine'
import { createMockProjectAnalysis } from '@/lib/ai/mock-data'
import { isTestSubscriptionModeEnabled } from '@/lib/subscription/test-mode'

export async function POST(request: NextRequest) {
  let project_id: string | undefined
  try {
    const body = await request.json()
    project_id = body.project_id
    const { regenerate } = body

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()

    // Fetch project
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (isTestSubscriptionModeEnabled()) {
      // Development-only test mode skips paid AI providers on Vercel Preview/local
      // and writes the same completed project fields as the real analysis flow.
      const mockAnalysis = createMockProjectAnalysis(project)

      const { error: updateError } = await adminClient
        .from('projects')
        .update({
          status: 'completed',
          business_analysis: mockAnalysis.businessAnalysis,
          competitor_analysis: mockAnalysis.competitorAnalysis,
          campaign_strategy: mockAnalysis.campaignStrategy,
          forecasts: mockAnalysis.forecasts,
          updated_at: new Date().toISOString(),
        })
        .eq('id', project_id)
        .eq('user_id', user.id)

      if (updateError) throw new Error(updateError.message)

      await adminClient.from('usage_logs').insert({
        user_id: user.id,
        action: 'ai_analysis',
        metadata: { project_id, regenerate: regenerate || 'full', test_mode: true },
        tokens_used: 0,
      })

      return NextResponse.json({ success: true, message: 'Test analysis complete', test_mode: true })
    }

    // Run analysis pipeline
    const regenerateAll = regenerate === 'full'
    let businessAnalysis = project.business_analysis
    let competitorAnalysis = project.competitor_analysis
    let campaignStrategy = project.campaign_strategy
    let forecasts = project.forecasts

    // Website analysis
    if (!businessAnalysis || regenerateAll || regenerate === 'business') {
      businessAnalysis = await analyzeWebsite(project.website_url, project.business_goal)
    }

    // Competitor analysis
    if (!competitorAnalysis || regenerateAll || regenerate === 'competitors') {
      competitorAnalysis = await analyzeCompetitors(businessAnalysis, project.target_country)
    }

    // Campaign strategy
    if (!campaignStrategy || regenerateAll || regenerate === 'strategy') {
      campaignStrategy = await generateCampaignStrategy(
        businessAnalysis,
        competitorAnalysis,
        project.business_goal,
        project.monthly_budget,
        project.platforms,
        project.target_country
      )
    }

    // Forecasting
    if (!forecasts || regenerateAll || regenerate === 'forecasts') {
      forecasts = await generateForecasts(
        businessAnalysis,
        campaignStrategy,
        project.monthly_budget,
        project.business_goal
      )
    }

    // Update project with all analysis results
    const { error: updateError } = await adminClient
      .from('projects')
      .update({
        status: 'completed',
        business_analysis: businessAnalysis,
        competitor_analysis: competitorAnalysis,
        campaign_strategy: campaignStrategy,
        forecasts,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project_id)
      .eq('user_id', user.id)

    if (updateError) throw new Error(updateError.message)

    // Log usage
    await adminClient.from('usage_logs').insert({
      user_id: user.id,
      action: 'ai_analysis',
      metadata: { project_id, regenerate: regenerate || 'full' },
      tokens_used: 8000,
    })

    return NextResponse.json({ success: true, message: 'Analysis complete' })
  } catch (error) {
    console.error('AI Analysis error:', error)

    // Mark project as error
    if (project_id) {
      const adminClient = createAdminClient()
      await adminClient
        .from('projects')
        .update({ status: 'error' })
        .eq('id', project_id)
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}
