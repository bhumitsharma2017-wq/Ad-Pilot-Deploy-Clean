import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { PLAN_PREVIEW_COOKIE } from '@/lib/subscription/preview'
import { getServerEffectivePlan } from '@/lib/subscription/test-mode'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()

    // Load through the server so the Reports page sees the same authenticated
    // data on local dev, Vercel Preview, and deployed test environments.
    const { data: memberships, error: membershipsError } = await adminClient
      .from('team_members')
      .select('owner_id')
      .eq('member_id', user.id)
      .not('accepted_at', 'is', null)
    if (membershipsError) throw new Error(membershipsError.message)

    const workspaceOwnerIds = [...new Set([user.id, ...(memberships || []).map(member => member.owner_id)])]
    const { data: projects, error: projectsError } = await adminClient
      .from('projects')
      .select('*')
      .in('user_id', workspaceOwnerIds)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })

    if (projectsError) throw new Error(projectsError.message)
    const { data: workspaceSubscriptions, error: subscriptionsError } = await adminClient
      .from('subscriptions')
      .select('user_id, plan')
      .in('user_id', workspaceOwnerIds)
    if (subscriptionsError) throw new Error(subscriptionsError.message)
    const planByOwner = new Map((workspaceSubscriptions || []).map(subscription => [subscription.user_id, subscription.plan]))
    const previewCookie = request.cookies.get(PLAN_PREVIEW_COOKIE)?.value
    const projectIds = (projects || []).map(project => project.id)
    const { data: reports, error: reportsError } = projectIds.length
      ? await adminClient
        .from('reports')
        .select('*')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
      : { data: [], error: null }
    if (reportsError) throw new Error(reportsError.message)

    return NextResponse.json(
      {
        projects: (projects || []).map(project => ({
          ...project,
          shared_with_you: project.user_id !== user.id,
          workspace_plan: getServerEffectivePlan(planByOwner.get(project.user_id), previewCookie),
        })),
        reports: reports || [],
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Reports list error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load reports' },
      { status: 500 }
    )
  }
}
