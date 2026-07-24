import Razorpay from 'razorpay'
import crypto from 'crypto'

let razorpayClient: Razorpay | null = null

function getRazorpayClient() {
  if (razorpayClient) return razorpayClient

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required')
  }

  razorpayClient = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  })

  return razorpayClient
}

export interface RazorpaySubscriptionResponse {
  id: string
  customer_id: string | null
}

// Create a Razorpay customer
export async function createRazorpayCustomer(params: {
  name: string
  email: string
  contact?: string
}) {
  return getRazorpayClient().customers.create(params)
}

// Create a subscription
export async function createSubscription(params: {
  plan_id: string
  total_count?: number
  quantity?: number
  customer_notify?: boolean
  notes?: Record<string, string | number>
}): Promise<RazorpaySubscriptionResponse> {
  return getRazorpayClient().subscriptions.create({
    plan_id: params.plan_id,
    total_count: params.total_count || 12,
    quantity: params.quantity || 1,
    customer_notify: params.customer_notify ?? true,
    notes: params.notes,
  }) as unknown as Promise<RazorpaySubscriptionResponse>
}

// Create an order (for one-time payments)
export async function createOrder(params: {
  amount: number  // in paise (INR smallest unit)
  currency?: string
  receipt?: string
  notes?: Record<string, string>
}) {
  return getRazorpayClient().orders.create({
    amount: params.amount,
    currency: params.currency || 'INR',
    receipt: params.receipt || `order_${Date.now()}`,
    notes: params.notes,
  })
}

// Verify Razorpay payment signature
export function verifyPaymentSignature(params: {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}): boolean {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params
  const body = `${razorpay_order_id}|${razorpay_payment_id}`
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex')
  return expectedSignature === razorpay_signature
}

// Verify webhook signature
export function verifyWebhookSignature(body: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex')
  return expectedSignature === signature
}

// Get subscription details
export async function getSubscription(subscriptionId: string) {
  return getRazorpayClient().subscriptions.fetch(subscriptionId)
}

// Cancel subscription
export async function cancelSubscription(subscriptionId: string, cancelAtCycleEnd = true) {
  return getRazorpayClient().subscriptions.cancel(subscriptionId, cancelAtCycleEnd)
}

// Plan IDs (configure in Razorpay dashboard)
export const RAZORPAY_PLANS = {
  pro_monthly: process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID || 'plan_pro_monthly',
  pro_yearly: process.env.RAZORPAY_PRO_YEARLY_PLAN_ID || 'plan_pro_yearly',
  agency_monthly: process.env.RAZORPAY_AGENCY_MONTHLY_PLAN_ID || 'plan_agency_monthly',
  agency_yearly: process.env.RAZORPAY_AGENCY_YEARLY_PLAN_ID || 'plan_agency_yearly',
}
