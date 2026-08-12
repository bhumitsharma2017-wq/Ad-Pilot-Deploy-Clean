import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { PLAN_PREVIEW_COOKIE } from '@/lib/subscription/preview'
import {
  getServerEffectiveProfile,
  getServerEffectiveSubscription,
} from '@/lib/subscription/test-mode'

// GET /api/users/me
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const cookieStore = await cookies()
  const previewCookie = cookieStore.get(PLAN_PREVIEW_COOKIE)?.value

  const adminClient = createAdminClient()
  // An invited user becomes active the first time they load their account.
  // This avoids showing a permanent “pending” state after accepting Supabase’s invite email.
  await adminClient
    .from('team_members')
    .update({ accepted_at: new Date().toISOString() })
    .eq('member_id', user.id)
    .is('accepted_at', null)

  const [{ data: profile }, { data: subscription }, { data: usage }] = await Promise.all([
    adminClient.from('profiles').select('*').eq('id', user.id).single(),
    adminClient.from('subscriptions').select('*').eq('user_id', user.id).single(),
    adminClient.from('usage_logs')
      .select('tokens_used, action, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const totalTokens = usage?.reduce((sum, log) => sum + (log.tokens_used || 0), 0) || 0

  return NextResponse.json({
    profile: getServerEffectiveProfile(profile, subscription, previewCookie),
    subscription: getServerEffectiveSubscription(subscription, previewCookie),
    usage: {
      total_tokens: totalTokens,
      recent: usage?.slice(0, 10),
    },
  })
}

// PATCH /api/users/me — update profile
export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const allowed = ['full_name', 'company_name', 'phone', 'timezone', 'onboarding_completed']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (!(key in body)) continue
    if (key === 'onboarding_completed') {
      if (typeof body[key] !== 'boolean') {
        return NextResponse.json({ error: 'onboarding_completed must be true or false' }, { status: 400 })
      }
      updates[key] = body[key]
      continue
    }
    if (typeof body[key] === 'string') {
      const value = body[key].trim()
      if (value.length > 160) return NextResponse.json({ error: `${key} is too long` }, { status: 400 })
      updates[key] = value
    }
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No valid profile fields supplied' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE /api/users/me — permanently removes the authenticated account and
// cascades to profile-owned projects, campaigns, reports, and team records.
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (body.confirmation !== 'DELETE') {
    return NextResponse.json({ error: 'Confirmation is required to delete an account' }, { status: 400 })
  }

  try {
    const adminClient = createAdminClient()
    const { error } = await adminClient.auth.admin.deleteUser(user.id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete account' }, { status: 500 })
  }
}
