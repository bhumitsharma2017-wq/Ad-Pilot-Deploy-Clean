'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle, Crown, Loader2, Sparkles, Users, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import {
  getClientPlanPreviewSelection,
  getEffectiveSubscription,
  isPlanPreviewActive,
  PLAN_PREVIEW_AVAILABLE,
  type PlanPreviewSelection,
} from '@/lib/subscription/preview'
import type { Subscription, SubscriptionPlan } from '@/types'
import { PLAN_CONFIG } from '@/types'

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void }
  }
}

const PLAN_UI_META: Record<
  SubscriptionPlan,
  {
    icon: typeof Zap
    iconWrap: string
    iconColor: string
    accent: string
    popular?: boolean
  }
> = {
  free: {
    icon: Zap,
    iconWrap: 'bg-gray-100',
    iconColor: 'text-gray-600',
    accent: 'border-gray-200 bg-white hover:border-gray-300',
  },
  pro: {
    icon: Crown,
    iconWrap: 'bg-brand-50',
    iconColor: 'text-brand-600',
    accent: 'border-brand-500 shadow-lg shadow-brand-100',
    popular: true,
  },
  agency: {
    icon: Users,
    iconWrap: 'bg-violet-50',
    iconColor: 'text-violet-600',
    accent: 'border-violet-200 bg-white hover:border-violet-300',
  },
}

const PLAN_ORDER: SubscriptionPlan[] = ['free', 'pro', 'agency']

const PREVIEW_OPTIONS: { value: PlanPreviewSelection; label: string }[] = [
  { value: 'free', label: 'Preview Free' },
  { value: 'pro', label: 'Preview Pro' },
  { value: 'agency', label: 'Preview Agency' },
  { value: 'off', label: 'Use Actual Plan' },
]

function getInitialPreviewSelection(): PlanPreviewSelection | null {
  if (!PLAN_PREVIEW_AVAILABLE) return null
  return getClientPlanPreviewSelection()
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [previewSelection, setPreviewSelection] = useState<PlanPreviewSelection | null>(getInitialPreviewSelection)
  const [savingPreview, setSavingPreview] = useState<PlanPreviewSelection | null>(null)

  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const paymentsDisabled = isPlanPreviewActive(previewSelection)
  const effectiveSubscription = getEffectiveSubscription(subscription, previewSelection)
  const activePlan = effectiveSubscription?.plan || 'free'

  const loadRazorpayScript = useCallback(() => {
    if (typeof window !== 'undefined' && !window.Razorpay) {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      document.head.appendChild(script)
    }
  }, [])

  const loadSubscription = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoadingData(false)
      return
    }

    const { data } = await supabase.from('subscriptions').select('*').eq('user_id', user.id).single()
    setSubscription(data)
    setPreviewSelection(getInitialPreviewSelection())
    setLoadingData(false)
  }, [supabase])

  useEffect(() => {
    void loadSubscription()
  }, [loadSubscription])

  useEffect(() => {
    if (!paymentsDisabled) {
      loadRazorpayScript()
    }
  }, [loadRazorpayScript, paymentsDisabled])

  const updatePreview = async (selection: PlanPreviewSelection) => {
    if (!PLAN_PREVIEW_AVAILABLE || previewSelection === selection) return

    setSavingPreview(selection)

    try {
      const response = await fetch('/api/subscription/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selection }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setPreviewSelection(selection)
      await loadSubscription()
      router.refresh()

      toast.success(
        selection === 'off'
          ? 'Using your actual subscription again'
          : `Previewing the ${selection} plan`
      )
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Preview update failed')
    } finally {
      setSavingPreview(null)
    }
  }

  const handleUpgrade = async (planId: SubscriptionPlan) => {
    if (paymentsDisabled) {
      await updatePreview(planId)
      return
    }

    if (planId === 'free' || planId === subscription?.plan) return
    setLoading(planId)

    try {
      const response = await fetch('/api/webhooks/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, billing_cycle: billing }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      if (data.test_mode) {
        setSubscription(data.subscription)
        toast.success(`Test mode activated: ${planId} plan is unlocked.`)
        router.push(data.redirect_url || '/dashboard')
        router.refresh()
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()

      const options = {
        key: data.razorpay_key,
        subscription_id: data.subscription_id,
        name: 'AdPilot AI',
        description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan - ${billing}`,
        image: '/logo.png',
        prefill: {
          name: profile?.full_name || '',
          email: user?.email || '',
        },
        theme: { color: '#4f46e5' },
        handler: async () => {
          toast.success(`Subscription activated! Welcome to ${planId}.`)
          await loadSubscription()
          router.refresh()
        },
        modal: {
          ondismiss: () => setLoading(null),
        },
      }

      const razorpay = new window.Razorpay(options)
      razorpay.open()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Subscription failed')
    } finally {
      setLoading(null)
    }
  }

  if (loadingData) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-96 bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-8">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
          <p className="text-gray-500 mt-1">
            Viewing <span className="font-medium text-brand-600 capitalize">{activePlan}</span>
            {subscription?.plan && subscription.plan !== activePlan && (
              <span className="text-gray-400"> - actual database plan is {subscription.plan}</span>
            )}
            {effectiveSubscription?.current_period_end && !paymentsDisabled && (
              <span className="text-gray-400 ml-2">
                Renews {new Date(effectiveSubscription.current_period_end).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>

        {PLAN_PREVIEW_AVAILABLE && (
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white text-amber-600 flex items-center justify-center shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-amber-950">Plan preview mode</div>
                <p className="text-sm text-amber-800 mt-1">
                  Razorpay checkout is temporarily disabled here so you can switch between Free, Pro,
                  and Agency experiences without making a payment.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {PREVIEW_OPTIONS.map((option) => {
                    const isSelected =
                      option.value === 'off'
                        ? !paymentsDisabled
                        : activePlan === option.value && paymentsDisabled

                    return (
                      <button
                        key={option.value}
                        onClick={() => void updatePreview(option.value)}
                        disabled={savingPreview === option.value}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-amber-900 text-white shadow-sm'
                            : 'bg-white text-amber-900 border border-amber-200 hover:border-amber-300'
                        }`}
                      >
                        {savingPreview === option.value ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </span>
                        ) : (
                          option.label
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm ${billing === 'monthly' ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
          Monthly
        </span>
        <button
          onClick={() => setBilling(billing === 'monthly' ? 'yearly' : 'monthly')}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            billing === 'yearly' ? 'bg-brand-600' : 'bg-gray-200'
          }`}
        >
          <div
            className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              billing === 'yearly' ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
        <span className={`text-sm ${billing === 'yearly' ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
          Yearly
          <span className="ml-1.5 px-1.5 py-0.5 bg-green-50 text-green-600 text-xs rounded-full">Save 17%</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLAN_ORDER.map((planId) => {
          const plan = PLAN_CONFIG[planId]
          const ui = PLAN_UI_META[planId]
          const price = billing === 'monthly' ? plan.price_monthly : plan.price_yearly
          const Icon = ui.icon
          const isCurrentPlan = activePlan === planId
          const isBusy = loading === planId || savingPreview === planId

          return (
            <div
              key={planId}
              className={`relative rounded-2xl border p-6 transition-all ${
                ui.popular
                  ? ui.accent
                  : isCurrentPlan
                  ? 'border-green-300 bg-green-50'
                  : ui.accent
              }`}
            >
              {ui.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-brand-600 text-white text-xs font-semibold rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              {isCurrentPlan && (
                <div className="absolute -top-3 right-4">
                  <span className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {paymentsDisabled ? 'Previewing' : 'Active'}
                  </span>
                </div>
              )}

              <div className={`w-10 h-10 rounded-xl ${ui.iconWrap} flex items-center justify-center mb-4`}>
                <Icon className={`w-5 h-5 ${ui.iconColor}`} />
              </div>

              <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>

              <div className="mt-3 mb-5">
                {price === 0 ? (
                  <div className="text-3xl font-bold text-gray-900">Free</div>
                ) : (
                  <div>
                    <span className="text-3xl font-bold text-gray-900">Rs {price.toLocaleString()}</span>
                    <span className="text-gray-500 text-sm">/{billing === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                )}
              </div>

              <ul className="space-y-2.5 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => void handleUpgrade(planId)}
                disabled={isCurrentPlan || isBusy}
                className={`w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                  isCurrentPlan
                    ? 'bg-green-100 text-green-700 cursor-not-allowed'
                    : ui.popular
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {isBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Working...
                  </>
                ) : isCurrentPlan ? (
                  paymentsDisabled ? 'Previewing this plan' : 'Current Plan'
                ) : paymentsDisabled ? (
                  <>
                    Preview {plan.name}
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : planId === 'free' ? (
                  'Default Plan'
                ) : (
                  <>
                    Upgrade to {plan.name}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {paymentsDisabled ? (
        <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-600 text-center">
          Preview mode is active, so payment collection is disabled. Use the buttons above to browse each plan.
        </div>
      ) : effectiveSubscription?.plan !== 'free' ? (
        <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-500 text-center">
          Cancel anytime. You will retain access until the end of your billing period.
          <a href="mailto:support@adpilot.ai" className="ml-1 text-brand-600 hover:underline">
            Contact support to cancel.
          </a>
        </div>
      ) : null}
    </div>
  )
}
