import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import {
  createSubscription,
  RAZORPAY_PLANS,
  type RazorpaySubscriptionResponse,
} from '@/lib/razorpay/client'
import { isPlanPreviewActive, PLAN_PREVIEW_COOKIE } from '@/lib/subscription/preview'
import {
  activateTestSubscription,
  isTestSubscriptionModeEnabled,
} from '@/lib/subscription/test-mode'
import type { SubscriptionPlan } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { plan, billing_cycle = 'monthly' } = await request.json()

    const previewCookie = request.cookies.get(PLAN_PREVIEW_COOKIE)?.value
    if (isPlanPreviewActive(previewCookie)) {
      return NextResponse.json(
        { error: 'Razorpay checkout is temporarily disabled while plan preview mode is active.' },
        { status: 403 }
      )
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()

    // TEST_SUBSCRIPTION_MODE is for local/Vercel Preview QA only. It stores an
    // active mock subscription and exits before any Razorpay SDK call is made.
    if (isTestSubscriptionModeEnabled()) {
      if (plan !== 'pro' && plan !== 'agency') {
        return NextResponse.json({ error: 'Invalid paid test plan' }, { status: 400 })
      }

      const subscription = await activateTestSubscription({
        adminClient,
        userId: user.id,
        plan: plan as SubscriptionPlan,
        billingCycle: billing_cycle === 'yearly' ? 'yearly' : 'monthly',
      })

      return NextResponse.json({
        success: true,
        test_mode: true,
        subscription,
        redirect_url: plan === 'agency' ? '/team' : '/dashboard',
        plan,
      })
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single()

    // Get plan ID
    const planKey = `${plan}_${billing_cycle}` as keyof typeof RAZORPAY_PLANS
    const planId = RAZORPAY_PLANS[planKey]
    if (!planId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // Create Razorpay subscription
    const razorpaySubscription = (await createSubscription({
      plan_id: planId,
      customer_notify: true,
      notes: {
        user_id: user.id,
        plan,
        billing_cycle,
        email: profile?.email || user.email || '',
        name: profile?.full_name || 'User',
      },
    })) as RazorpaySubscriptionResponse

    // Update local subscription record
    await adminClient
      .from('subscriptions')
      .update({
        razorpay_customer_id: razorpaySubscription.customer_id,
        razorpay_subscription_id: razorpaySubscription.id,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      subscription_id: razorpaySubscription.id,
      customer_id: razorpaySubscription.customer_id,
      razorpay_key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: billing_cycle === 'monthly'
        ? (plan === 'pro' ? 299900 : 799900)  // in paise
        : (plan === 'pro' ? 2999900 : 7999900),
      currency: 'INR',
      plan,
    })
  } catch (error) {
    console.error('Subscription error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Subscription failed' },
      { status: 500 }
    )
  }
}
