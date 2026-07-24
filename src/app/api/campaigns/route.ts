import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()

    // Server-side read avoids browser RLS/session edge cases while still
    // enforcing that the requested project belongs to the authenticated user.
    const { data: project } = await adminClient
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { data: campaigns, error } = await adminClient
      .from('campaigns')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    return NextResponse.json(
      { campaigns: campaigns || [] },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Campaign list error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load campaigns' },
      { status: 500 }
    )
  }
}
