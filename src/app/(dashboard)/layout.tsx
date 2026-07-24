import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import {
  getEffectiveProfile,
  getEffectiveSubscription,
  PLAN_PREVIEW_COOKIE,
  resolvePreviewPlan,
} from '@/lib/subscription/preview'
import { PLAN_CONFIG } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const cookieStore = await cookies()
  const previewCookie = cookieStore.get(PLAN_PREVIEW_COOKIE)?.value
  const previewPlan = resolvePreviewPlan(previewCookie)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const effectiveProfile = getEffectiveProfile(profile, previewCookie)
  const effectiveSubscription = getEffectiveSubscription(subscription, previewCookie)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar profile={effectiveProfile} subscription={effectiveSubscription} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar profile={profile} />
        {previewPlan && (
          <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-sm text-amber-900">
            Preview mode is on. Browsing the {PLAN_CONFIG[previewPlan].name} plan with Razorpay checkout disabled.
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
