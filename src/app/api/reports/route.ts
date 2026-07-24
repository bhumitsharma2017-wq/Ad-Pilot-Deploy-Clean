import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()

    // Load through the server so the Reports page sees the same authenticated
    // data on local dev, Vercel Preview, and deployed test environments.
    const [{ data: projects, error: projectsError }, { data: reports, error: reportsError }] = await Promise.all([
      adminClient
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false }),
      adminClient
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    if (projectsError) throw new Error(projectsError.message)
    if (reportsError) throw new Error(reportsError.message)

    return NextResponse.json(
      { projects: projects || [], reports: reports || [] },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Reports list error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load reports' },
      { status: 500 }
    )
  }
}
