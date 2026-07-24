import type { Profile, Subscription, SubscriptionPlan, UserRole } from '@/types'

export type PlanPreviewSelection = SubscriptionPlan | 'off'

export const PLAN_PREVIEW_COOKIE = 'adpilot_plan_preview'
export const DEFAULT_PREVIEW_PLAN: SubscriptionPlan = 'agency'
export const PLAN_PREVIEW_AVAILABLE =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_ENABLE_PLAN_PREVIEW === 'true'

const PLAN_ORDER: Record<UserRole, number> = {
  free: 0,
  pro: 1,
  agency: 2,
  admin: 3,
}

export function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  return value === 'free' || value === 'pro' || value === 'agency'
}

export function isPlanPreviewSelection(value: unknown): value is PlanPreviewSelection {
  return value === 'off' || isSubscriptionPlan(value)
}

export function normalizePlanPreviewSelection(value: unknown): PlanPreviewSelection | null {
  return isPlanPreviewSelection(value) ? value : null
}

export function resolvePlanPreviewSelection(rawValue: string | null | undefined): PlanPreviewSelection | null {
  if (!PLAN_PREVIEW_AVAILABLE) return null
  if (!rawValue) return null

  return normalizePlanPreviewSelection(rawValue)
}

export function resolvePreviewPlan(rawValue: string | null | undefined): SubscriptionPlan | null {
  const selection = resolvePlanPreviewSelection(rawValue)
  if (!selection || selection === 'off') return null
  return selection
}

export function getEffectivePlan(
  actualPlan: string | null | undefined,
  rawPreviewValue?: string | null
): SubscriptionPlan {
  const previewPlan = resolvePreviewPlan(rawPreviewValue)
  if (previewPlan) return previewPlan
  return isSubscriptionPlan(actualPlan) ? actualPlan : 'free'
}

export function getEffectiveSubscription(
  subscription: Subscription | null,
  rawPreviewValue?: string | null
): Subscription | null {
  const previewPlan = resolvePreviewPlan(rawPreviewValue)
  if (!previewPlan) return subscription

  const now = new Date().toISOString()

  return {
    id: subscription?.id || 'preview-subscription',
    user_id: subscription?.user_id || 'preview-user',
    plan: previewPlan,
    status: 'active',
    razorpay_subscription_id: subscription?.razorpay_subscription_id || null,
    razorpay_customer_id: subscription?.razorpay_customer_id || null,
    current_period_start: subscription?.current_period_start || now,
    current_period_end: subscription?.current_period_end || null,
    cancel_at_period_end: false,
    trial_ends_at: subscription?.trial_ends_at || null,
    created_at: subscription?.created_at || now,
    updated_at: now,
  }
}

export function getEffectiveProfile(
  profile: Profile | null,
  rawPreviewValue?: string | null
): Profile | null {
  if (!profile) return profile

  const previewPlan = resolvePreviewPlan(rawPreviewValue)
  if (!previewPlan || profile.role === 'admin') return profile

  return {
    ...profile,
    role: previewPlan,
  }
}

export function hasRequiredPlan(
  actualPlan: string | null | undefined,
  requiredPlan: SubscriptionPlan,
  rawPreviewValue?: string | null
): boolean {
  const effectivePlan = getEffectivePlan(actualPlan, rawPreviewValue)
  return PLAN_ORDER[effectivePlan] >= PLAN_ORDER[requiredPlan]
}

export function getProjectLimitForPlan(
  actualPlan: string | null | undefined,
  rawPreviewValue?: string | null
): number | null {
  const effectivePlan = getEffectivePlan(actualPlan, rawPreviewValue)
  return effectivePlan === 'free' ? 3 : null
}

export function isPlanPreviewActive(rawPreviewValue: string | null | undefined): boolean {
  return resolvePreviewPlan(rawPreviewValue) !== null
}

export function getClientPlanPreviewSelection(): PlanPreviewSelection | null {
  if (typeof document === 'undefined') return null

  const cookiePrefix = `${PLAN_PREVIEW_COOKIE}=`
  const match = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(cookiePrefix))

  if (!match) return null

  const rawValue = decodeURIComponent(match.slice(cookiePrefix.length))
  return normalizePlanPreviewSelection(rawValue)
}
