import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, Subscription, SubscriptionPlan } from '@/types'
import {
  getEffectiveProfile,
  getEffectiveSubscription,
  getProjectLimitForPlan,
  hasRequiredPlan,
  isSubscriptionPlan,
} from '@/lib/subscription/preview'

const ENABLED_VALUES = ['true', '1', 'yes', 'on']
const DEFAULT_TEST_PLAN: SubscriptionPlan = 'agency'

// Development-only safety switch. Even if this env var is accidentally set,
// production keeps using the real Razorpay subscription flow.
export function isTestSubscriptionModeEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    ENABLED_VALUES.includes((process.env.TEST_SUBSCRIPTION_MODE || '').toLowerCase())
  )
}

function getTestFallbackPlan(actualPlan: string | null | undefined): SubscriptionPlan {
  if (actualPlan === 'pro' || actualPlan === 'agency') return actualPlan
  return DEFAULT_TEST_PLAN
}

export function getServerEffectivePlan(
  actualPlan: string | null | undefined,
  rawPreviewValue?: string | null
): SubscriptionPlan {
  if (isTestSubscriptionModeEnabled()) {
    return getTestFallbackPlan(actualPlan)
  }

  const previewSubscription = getEffectiveSubscription(
    actualPlan && isSubscriptionPlan(actualPlan)
      ? ({
          id: 'preview-plan-check',
          user_id: 'preview-user',
          plan: actualPlan,
          status: 'active',
          razorpay_subscription_id: null,
          razorpay_customer_id: null,
          current_period_start: null,
          current_period_end: null,
          cancel_at_period_end: false,
          trial_ends_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } satisfies Subscription)
      : null,
    rawPreviewValue
  )

  return previewSubscription?.plan || (isSubscriptionPlan(actualPlan) ? actualPlan : 'free')
}

export function getServerEffectiveSubscription(
  subscription: Subscription | null,
  rawPreviewValue?: string | null
): Subscription | null {
  if (!isTestSubscriptionModeEnabled()) {
    return getEffectiveSubscription(subscription, rawPreviewValue)
  }

  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  // Direct visits to paid pages in test mode should see an active paid plan
  // even before the tester clicks a subscription button.
  return {
    id: subscription?.id || 'test-mode-subscription',
    user_id: subscription?.user_id || 'test-mode-user',
    plan: getTestFallbackPlan(subscription?.plan),
    status: 'active',
    razorpay_subscription_id: subscription?.razorpay_subscription_id || 'test_mode_subscription',
    razorpay_customer_id: subscription?.razorpay_customer_id || 'test_mode_customer',
    current_period_start: subscription?.current_period_start || now.toISOString(),
    current_period_end: subscription?.current_period_end || periodEnd.toISOString(),
    cancel_at_period_end: false,
    trial_ends_at: subscription?.trial_ends_at || null,
    created_at: subscription?.created_at || now.toISOString(),
    updated_at: now.toISOString(),
  }
}

export function getServerEffectiveProfile(
  profile: Profile | null,
  subscription: Subscription | null,
  rawPreviewValue?: string | null
): Profile | null {
  if (!profile) return profile

  if (!isTestSubscriptionModeEnabled()) {
    return getEffectiveProfile(profile, rawPreviewValue)
  }

  if (profile.role === 'admin') return profile

  return {
    ...profile,
    role: getTestFallbackPlan(subscription?.plan),
  }
}

export function hasServerRequiredPlan(
  actualPlan: string | null | undefined,
  requiredPlan: SubscriptionPlan,
  rawPreviewValue?: string | null
): boolean {
  if (isTestSubscriptionModeEnabled()) {
    return hasRequiredPlan(getTestFallbackPlan(actualPlan), requiredPlan)
  }

  return hasRequiredPlan(actualPlan, requiredPlan, rawPreviewValue)
}

export function getServerProjectLimitForPlan(
  actualPlan: string | null | undefined,
  rawPreviewValue?: string | null
): number | null {
  if (isTestSubscriptionModeEnabled()) return null
  return getProjectLimitForPlan(actualPlan, rawPreviewValue)
}

export async function activateTestSubscription(params: {
  adminClient: SupabaseClient
  userId: string
  plan: SubscriptionPlan
  billingCycle: 'monthly' | 'yearly'
}): Promise<Subscription> {
  const { adminClient, userId, plan, billingCycle } = params
  const now = new Date()
  const periodEnd = new Date(now)

  if (billingCycle === 'yearly') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  }

  const subscriptionPayload = {
    plan,
    status: 'active',
    razorpay_customer_id: `test_customer_${userId.slice(0, 8)}`,
    razorpay_subscription_id: `test_subscription_${plan}_${Date.now()}`,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    cancel_at_period_end: false,
    updated_at: now.toISOString(),
  }

  const { data: existing } = await adminClient
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  const query = existing?.id
    ? adminClient
        .from('subscriptions')
        .update(subscriptionPayload)
        .eq('id', existing.id)
    : adminClient
        .from('subscriptions')
        .insert({ user_id: userId, ...subscriptionPayload })

  const { data: subscription, error } = await query.select().single()

  if (error) {
    throw new Error(error.message)
  }

  // Match the real successful webhook behavior by promoting the profile role.
  await adminClient
    .from('profiles')
    .update({ role: plan, updated_at: now.toISOString() })
    .eq('id', userId)

  return subscription as Subscription
}
