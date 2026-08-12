import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { generateReport } from '@/lib/ai/engine'
import { createMockReport } from '@/lib/ai/mock-data'
import { PLAN_PREVIEW_COOKIE } from '@/lib/subscription/preview'
import { hasServerRequiredPlan, shouldUseMockReport } from '@/lib/subscription/test-mode'
import { canEditProject, getProjectAccess } from '@/lib/project-access'

type ReportType = 'weekly' | 'monthly' | 'quarterly' | 'client_presentation'

export async function POST(request: NextRequest) {
  try {
    const { project_id, type } = await request.json() as { project_id: string; type: ReportType }
    const previewCookie = request.cookies.get(PLAN_PREVIEW_COOKIE)?.value
    if (!project_id || !['weekly', 'monthly', 'quarterly', 'client_presentation'].includes(type)) {
      return NextResponse.json({ error: 'Invalid report request' }, { status: 400 })
    }
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()

    const { project, permission } = await getProjectAccess(adminClient, user.id, project_id)
    if (!project || !canEditProject(permission)) {
      return NextResponse.json({ error: 'Project not found or you do not have report access' }, { status: 404 })
    }

    const { data: sub } = await adminClient
      .from('subscriptions')
      .select('plan')
      .eq('user_id', project.user_id)
      .single()

    if (!hasServerRequiredPlan(sub?.plan, 'pro', previewCookie)) {
      return NextResponse.json({ error: 'This workspace needs a Pro or Agency subscription to generate reports' }, { status: 403 })
    }

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

    const previewOnly = shouldUseMockReport()
    // Test mode only uses a labelled sample report when no configured provider
    // can generate the real report. OpenAI is a fallback if Anthropic is absent.
    const reportContent = previewOnly
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
        // Keep project deliverables in the workspace owner's library, even when
        // an invited teammate starts the generation.
        user_id: project.user_id,
        type,
        title: `${project.name} - ${typeLabels[type]} - ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
        content: { text: reportContent, generated_at: new Date().toISOString(), preview_only: previewOnly },
      })
      .select()
      .single()

    if (reportError) throw new Error(reportError.message)

    return NextResponse.json({
      success: true,
      report,
      preview_only: previewOnly,
      message: previewOnly ? 'Preview report created. Add an AI provider key for a real report.' : undefined,
    })
  } catch (error) {
    console.error('Report generation error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Report generation failed' }, { status: 500 })
  }
}
