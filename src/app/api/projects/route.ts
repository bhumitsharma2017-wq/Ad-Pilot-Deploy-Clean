import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { PLAN_PREVIEW_COOKIE } from '@/lib/subscription/preview'
import { getServerEffectivePlan, getServerProjectLimitForPlan } from '@/lib/subscription/test-mode'
import {
  isBusinessGoal,
  normalizeCountry,
  normalizeMonthlyBudget,
  normalizePlatforms,
  normalizePublicWebsiteUrl,
} from '@/lib/validation'

// GET /api/projects — list user projects
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') || '50')
  const page = parseInt(searchParams.get('page') || '1')
  const offset = (page - 1) * limit
  const includeShared = searchParams.get('scope') === 'accessible'
  const previewCookie = request.cookies.get(PLAN_PREVIEW_COOKIE)?.value

  const adminClient = createAdminClient()
  let accessibleUserIds = [user.id]
  if (includeShared) {
    const { data: memberships } = await adminClient
      .from('team_members')
      .select('owner_id')
      .eq('member_id', user.id)
      .not('accepted_at', 'is', null)
    accessibleUserIds = [...new Set([user.id, ...(memberships || []).map(member => member.owner_id)])]
  }

  let query = adminClient
    .from('projects')
    .select('*', { count: 'exact' })
    .in('user_id', accessibleUserIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)

  const { data, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { data: workspaceSubscriptions, error: subscriptionsError } = await adminClient
    .from('subscriptions')
    .select('user_id, plan')
    .in('user_id', accessibleUserIds)
  if (subscriptionsError) return NextResponse.json({ error: subscriptionsError.message }, { status: 500 })
  const planByOwner = new Map((workspaceSubscriptions || []).map(subscription => [subscription.user_id, subscription.plan]))

  return NextResponse.json({
    data: (data || []).map(project => ({
      ...project,
      shared_with_you: project.user_id !== user.id,
      workspace_plan: getServerEffectivePlan(planByOwner.get(project.user_id), previewCookie),
    })),
    count,
    page,
    limit,
    total_pages: Math.ceil((count || 0) / limit),
  })
}

// POST /api/projects — create project
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { website_url, business_goal, monthly_budget, target_country, platforms } = body
  const previewCookie = request.cookies.get(PLAN_PREVIEW_COOKIE)?.value
  const normalizedUrl = normalizePublicWebsiteUrl(website_url)
  const normalizedPlatforms = normalizePlatforms(platforms)
  const normalizedBudget = normalizeMonthlyBudget(monthly_budget)
  const normalizedCountry = normalizeCountry(target_country || 'India')

  if (!normalizedUrl || !isBusinessGoal(business_goal) || !normalizedBudget || !normalizedCountry || !normalizedPlatforms) {
    return NextResponse.json({
      error: 'Enter a public website URL, valid goal, budget of at least 100, country, and one supported platform.',
    }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Check plan limits
  const { data: sub } = await adminClient
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single()

  const projectLimit = getServerProjectLimitForPlan(sub?.plan, previewCookie)

  if (projectLimit !== null) {
    const { count } = await adminClient
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((count || 0) >= projectLimit) {
      return NextResponse.json({
        error: `Free plan limit reached (${projectLimit} projects). Upgrade to Pro for unlimited projects.`,
      }, { status: 403 })
    }
  }

  const name = new URL(normalizedUrl).hostname.replace('www.', '')

  const { data: project, error } = await adminClient
    .from('projects')
    .insert({
      user_id: user.id,
      name,
      website_url: normalizedUrl,
      business_goal,
      monthly_budget: normalizedBudget,
      target_country: normalizedCountry,
      platforms: normalizedPlatforms,
      status: 'analyzing',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log usage
  await adminClient.from('usage_logs').insert({
    user_id: user.id,
    action: 'project_created',
    metadata: { project_id: project.id },
  })

  return NextResponse.json({ success: true, project }, { status: 201 })
}
