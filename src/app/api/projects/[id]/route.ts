import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import {
  isBusinessGoal,
  normalizeCountry,
  normalizeMonthlyBudget,
  normalizePlatforms,
} from '@/lib/validation'
import { canEditProject, getProjectAccess } from '@/lib/project-access'

type Params = { params: Promise<{ id: string }> }

// GET /api/projects/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { project } = await getProjectAccess(adminClient, user.id, id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: project })
}

// PATCH /api/projects/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const adminClient = createAdminClient()
  const { project, permission } = await getProjectAccess(adminClient, user.id, id)
  if (!project || !canEditProject(permission)) {
    return NextResponse.json({ error: 'Project not found or you do not have edit access' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if ('name' in body && typeof body.name === 'string') {
    const name = body.name.trim().replace(/\s+/g, ' ')
    if (name.length < 2 || name.length > 100) return NextResponse.json({ error: 'Project name must be 2-100 characters' }, { status: 400 })
    updates.name = name
  }
  if ('business_goal' in body) {
    if (!isBusinessGoal(body.business_goal)) return NextResponse.json({ error: 'Invalid business goal' }, { status: 400 })
    updates.business_goal = body.business_goal
  }
  if ('monthly_budget' in body) {
    const budget = normalizeMonthlyBudget(body.monthly_budget)
    if (!budget) return NextResponse.json({ error: 'Budget must be between 100 and 10,000,000' }, { status: 400 })
    updates.monthly_budget = budget
  }
  if ('target_country' in body) {
    const country = normalizeCountry(body.target_country)
    if (!country) return NextResponse.json({ error: 'Invalid target country' }, { status: 400 })
    updates.target_country = country
  }
  if ('platforms' in body) {
    const platforms = normalizePlatforms(body.platforms)
    if (!platforms) return NextResponse.json({ error: 'Select at least one supported platform' }, { status: 400 })
    updates.platforms = platforms
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No valid project fields supplied' }, { status: 400 })

  const { data, error } = await adminClient
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE /api/projects/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
