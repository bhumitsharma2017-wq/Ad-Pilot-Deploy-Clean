import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyWebhookSignature } from '@/lib/razorpay/client'

function toIsoFromEpoch(value: unknown): string | null {
  const timestamp = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp * 1000).toISOString() : null
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-razorpay-signature') || ''
  const body = await request.text()

  // Verify signature
  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(body) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
  }
  if (typeof event.id !== 'string' || typeof event.event !== 'string') {
    return NextResponse.json({ error: 'Invalid webhook event' }, { status: 400 })
  }
  const adminClient = createAdminClient()

  // Idempotency check
  const { data: existing } = await adminClient
    .from('payment_events')
    .select('id')
    .eq('event_id', event.id)
    .single()

  if (existing) return NextResponse.json({ status: 'already_processed' })

  // Store event
  await adminClient.from('payment_events').insert({
    event_id: event.id,
    event_type: event.event,
    payload: event,
  })

  const eventPayload = event.payload as Record<string, unknown> | undefined
  const subscriptionPayload = (eventPayload?.subscription as { entity?: Record<string, unknown> } | undefined)?.entity
  const paymentPayload = (eventPayload?.payment as { entity?: Record<string, unknown> } | undefined)?.entity

  switch (event.event) {
    case 'subscription.activated': {
      const subscriptionId = String(subscriptionPayload?.id || '')
      const customerId = String(subscriptionPayload?.customer_id || '')

      if (!subscriptionId) break

      let { data: sub } = await adminClient
        .from('subscriptions')
        .select('user_id')
        .eq('razorpay_subscription_id', subscriptionId)
        .single()

      if (!sub && customerId) {
        const { data: customerSub } = await adminClient
          .from('subscriptions')
          .select('user_id')
          .eq('razorpay_customer_id', customerId)
          .single()
        sub = customerSub
      }

      if (sub) {
        // Determine plan from plan_id
        const planId = String(subscriptionPayload?.plan_id || '')
        let plan = 'pro'
        const agencyPlans = [process.env.RAZORPAY_AGENCY_MONTHLY_PLAN_ID, process.env.RAZORPAY_AGENCY_YEARLY_PLAN_ID]
        if (agencyPlans.includes(planId)) plan = 'agency'

        await adminClient.from('subscriptions').update({
          plan,
          status: 'active',
          razorpay_subscription_id: subscriptionId,
          razorpay_customer_id: customerId,
          current_period_start: toIsoFromEpoch(subscriptionPayload?.current_start),
          current_period_end: toIsoFromEpoch(subscriptionPayload?.current_end),
          updated_at: new Date().toISOString(),
        }).eq('user_id', sub.user_id)

        await adminClient.from('profiles').update({ role: plan }).eq('id', sub.user_id)
      }
      break
    }

    case 'subscription.cancelled':
    case 'subscription.completed': {
      const subscriptionId = String(subscriptionPayload?.id || '')
      if (!subscriptionId) break
      const { data: sub } = await adminClient
        .from('subscriptions')
        .select('user_id')
        .eq('razorpay_subscription_id', subscriptionId)
        .single()

      if (sub) {
        await adminClient.from('subscriptions').update({
          status: event.event === 'subscription.cancelled' ? 'cancelled' : 'expired',
          updated_at: new Date().toISOString(),
        }).eq('user_id', sub.user_id)

        await adminClient.from('profiles').update({ role: 'free' }).eq('id', sub.user_id)
      }
      break
    }

    case 'subscription.charged': {
      // Payment successful - extend period
      const subscriptionId = String(subscriptionPayload?.id || paymentPayload?.subscription_id || '')
      if (!subscriptionId) break
      const { data: sub } = await adminClient
        .from('subscriptions')
        .select('user_id')
        .eq('razorpay_subscription_id', subscriptionId)
        .single()

      if (sub) {
        await adminClient.from('subscriptions').update({
          status: 'active',
          current_period_start: toIsoFromEpoch(subscriptionPayload?.current_start),
          current_period_end: toIsoFromEpoch(subscriptionPayload?.current_end),
          updated_at: new Date().toISOString(),
        }).eq('user_id', sub.user_id)
      }
      break
    }
  }

  // Mark as processed
  await adminClient.from('payment_events').update({ processed: true }).eq('event_id', event.id)

  return NextResponse.json({ received: true })
}
