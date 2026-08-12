import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { cancelSubscription } from '@/lib/razorpay/client'
import { PLAN_PREVIEW_COOKIE, isPlanPreviewActive } from '@/lib/subscription/preview'
import { isTestSubscriptionModeEnabled } from '@/lib/subscription/test-mode'

export async function POST(request: NextRequest) {
  try {
    const previewCookie = request.cookies.get(PLAN_PREVIEW_COOKIE)?.value
    if (isPlanPreviewActive(previewCookie)) {
      return NextResponse.json({ error: 'Plan preview mode does not have a subscription to cancel' }, { status: 403 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: subscription } = await adminClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()
    if (!subscription || subscription.plan === 'free' || subscription.status !== 'active') {
      return NextResponse.json({ error: 'No active paid subscription found' }, { status: 400 })
    }

    if (subscription.cancel_at_period_end) {
      return NextResponse.json({ success: true, subscription, message: 'Your subscription is already scheduled to cancel.' })
    }

    if (!isTestSubscriptionModeEnabled()) {
      if (!subscription.razorpay_subscription_id) {
        return NextResponse.json({ error: 'Your subscription payment reference is missing. Please contact support.' }, { status: 409 })
      }
      await cancelSubscription(subscription.razorpay_subscription_id, true)
    }

    const { data: updated, error } = await adminClient
      .from('subscriptions')
      .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
      .eq('id', subscription.id)
      .select()
      .single()
    if (error) throw new Error(error.message)

    return NextResponse.json({
      success: true,
      subscription: updated,
      message: 'Your plan will stay active until the end of the current billing period.',
    })
  } catch (error) {
    console.error('Subscription cancellation error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not cancel subscription' }, { status: 500 })
  }
}
