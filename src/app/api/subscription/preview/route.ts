import { NextRequest, NextResponse } from 'next/server'
import {
  PLAN_PREVIEW_AVAILABLE,
  PLAN_PREVIEW_COOKIE,
  normalizePlanPreviewSelection,
  resolvePreviewPlan,
} from '@/lib/subscription/preview'

export async function POST(request: NextRequest) {
  if (!PLAN_PREVIEW_AVAILABLE) {
    return NextResponse.json({ error: 'Plan preview mode is disabled' }, { status: 403 })
  }

  const body = await request.json()
  const selection = normalizePlanPreviewSelection(body?.plan)

  if (!selection) {
    return NextResponse.json({ error: 'Invalid preview plan' }, { status: 400 })
  }

  const response = NextResponse.json({
    success: true,
    selection,
    preview_plan: resolvePreviewPlan(selection),
  })

  response.cookies.set(PLAN_PREVIEW_COOKIE, selection, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  })

  return response
}
