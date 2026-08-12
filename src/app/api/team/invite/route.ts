import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { PLAN_PREVIEW_COOKIE } from '@/lib/subscription/preview'
import { hasServerRequiredPlan } from '@/lib/subscription/test-mode'

const ROLES = ['admin', 'member', 'viewer'] as const
type TeamRole = (typeof ROLES)[number]

async function getOwnerContext(request: NextRequest) {
  const previewCookie = request.cookies.get(PLAN_PREVIEW_COOKIE)?.value
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const adminClient = createAdminClient()
  const { data: subscription } = await adminClient
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single()

  if (!hasServerRequiredPlan(subscription?.plan, 'agency', previewCookie)) {
    return { error: NextResponse.json({ error: 'Agency plan required for team members' }, { status: 403 }) }
  }

  return { user, adminClient }
}

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request)
    if ('error' in context) return context.error

    const { data, error } = await context.adminClient
      .from('team_members')
      .select('id, member_id, role, invited_at, accepted_at, profiles:member_id(full_name, email, avatar_url)')
      .eq('owner_id', context.user.id)
      .order('invited_at', { ascending: true })

    if (error) throw new Error(error.message)
    return NextResponse.json({ members: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Team list error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load team' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const role = ROLES.includes(body.role as TeamRole) ? body.role as TeamRole : 'member'
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    }

    const context = await getOwnerContext(request)
    if ('error' in context) return context.error

    let { data: memberProfile } = await context.adminClient
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()

    let invitationSent = false
    if (!memberProfile) {
      const { data: invite, error: inviteError } = await context.adminClient.auth.admin.inviteUserByEmail(email)
      if (inviteError) throw new Error(inviteError.message)
      if (!invite.user) throw new Error('Could not create an invitation for this email')

      // The profile trigger runs when the Supabase invite creates the auth user.
      // Re-read it so the team_members foreign key is always valid.
      const { data: invitedProfile, error: profileError } = await context.adminClient
        .from('profiles')
        .select('id, email')
        .eq('id', invite.user.id)
        .single()
      if (profileError || !invitedProfile) throw new Error('Invitation sent, but the profile could not be created')
      memberProfile = invitedProfile
      invitationSent = true
    }

    if (memberProfile.id === context.user.id) {
      return NextResponse.json({ error: 'You cannot add yourself as a team member' }, { status: 400 })
    }

    const { data: existing } = await context.adminClient
      .from('team_members')
      .select('id')
      .eq('owner_id', context.user.id)
      .eq('member_id', memberProfile.id)
      .maybeSingle()
    if (existing) return NextResponse.json({ error: 'This user is already on your team' }, { status: 409 })

    const { data: member, error: insertError } = await context.adminClient
      .from('team_members')
      .insert({
        owner_id: context.user.id,
        member_id: memberProfile.id,
        role,
        accepted_at: invitationSent ? null : new Date().toISOString(),
      })
      .select('id, member_id, role, invited_at, accepted_at')
      .single()
    if (insertError) throw new Error(insertError.message)

    return NextResponse.json({
      success: true,
      member,
      invitation_sent: invitationSent,
      message: invitationSent ? `Invitation email sent to ${email}` : `${email} was added to your team`,
    }, { status: 201 })
  } catch (error) {
    console.error('Team invite error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to invite team member' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const memberId = typeof body.member_id === 'string' ? body.member_id : ''
    const role = body.role
    if (!memberId || !ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid team member update' }, { status: 400 })
    }

    const context = await getOwnerContext(request)
    if ('error' in context) return context.error
    const { data, error } = await context.adminClient
      .from('team_members')
      .update({ role })
      .eq('owner_id', context.user.id)
      .eq('member_id', memberId)
      .select('id, member_id, role, invited_at, accepted_at')
      .single()
    if (error || !data) return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
    return NextResponse.json({ success: true, member: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update role' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const memberId = typeof body.member_id === 'string' ? body.member_id : ''
    if (!memberId) return NextResponse.json({ error: 'Team member ID required' }, { status: 400 })

    const context = await getOwnerContext(request)
    if ('error' in context) return context.error
    const { error } = await context.adminClient
      .from('team_members')
      .delete()
      .eq('owner_id', context.user.id)
      .eq('member_id', memberId)
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to remove team member' }, { status: 500 })
  }
}
