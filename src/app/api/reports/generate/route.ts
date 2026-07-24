import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { generateReport } from '@/lib/ai/engine'
import { createMockReport } from '@/lib/ai/mock-data'
import { PLAN_PREVIEW_COOKIE } from '@/lib/subscription/preview'
import { hasServerRequiredPlan, isTestSubscriptionModeEnabled } from '@/lib/subscription/test-mode'

type ReportType = 'weekly' | 'monthly' | 'quarterly' | 'client_presentation'

export async function POST(request: NextRequest) {
  try {
    const { project_id, type } = await request.json() as { project_id: string; type: ReportType }
    const previewCookie = request.cookies.get(PLAN_PREVIEW_COOKIE)?.value
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()

    const { data: sub } = await adminClient
      .from('subscriptions')
      .select('plan')
      .eq('user_id', user.id)
      .single()

    if (!hasServerRequiredPlan(sub?.plan, 'pro', previewCookie)) {
      return NextResponse.json({ error: 'Upgrade to Pro to generate reports' }, { status: 403 })
    }

    const { data: project } = await adminClient
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .single()

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const reportData = {
      project_name: project.name,
      website_url: project.website_url,
      business_goal: project.business_goal,
      monthly_budget: project.monthly_budget,
      platforms: project.platforms,
      business_analysis: project.business_analysis,
      competitor_analysis: project.competitor_analysis,
      campaign_strategy: project.campaign_strategy,
      forecasts: project.forecasts,
    }

    // Test mode uses sample report content so Preview deployments can validate
    // report creation/export even when Anthropic credentials are unavailable.
    const reportContent = isTestSubscriptionModeEnabled()
      ? createMockReport(type, project)
      : await generateReport(type === 'client_presentation' ? 'quarterly' : type, reportData)

    const typeLabels: Record<ReportType, string> = {
      weekly: 'Weekly Report',
      monthly: 'Monthly Report',
      quarterly: 'Quarterly Review',
      client_presentation: 'Client Presentation',
    }

    const { data: report, error: reportError } = await adminClient
      .from('reports')
      .insert({
        project_id,
        user_id: user.id,
        type,
        title: `${project.name} - ${typeLabels[type]} - ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
        content: { text: reportContent, generated_at: new Date().toISOString(), test_mode: isTestSubscriptionModeEnabled() },
      })
      .select()
      .single()

    if (reportError) throw new Error(reportError.message)

    return NextResponse.json({ success: true, report })
  } catch (error) {
    console.error('Report generation error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Report generation failed' }, { status: 500 })
  }
}
