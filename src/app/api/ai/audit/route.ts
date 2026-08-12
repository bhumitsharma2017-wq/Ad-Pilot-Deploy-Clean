import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { auditLandingPage } from '@/lib/ai/engine'
import { normalizePublicWebsiteUrl } from '@/lib/validation'
import { canEditProject, getProjectAccess } from '@/lib/project-access'

export async function POST(request: NextRequest) {
  try {
    const { project_id, url } = await request.json()
    if (typeof project_id !== 'string') return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
    const auditUrl = normalizePublicWebsiteUrl(url)
    if (!auditUrl) return NextResponse.json({ error: 'Enter a public http(s) landing page URL' }, { status: 400 })
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()
    const { project, permission } = await getProjectAccess(adminClient, user.id, project_id)

    if (!project?.business_analysis) {
      return NextResponse.json({ error: 'Run business analysis first' }, { status: 400 })
    }
    if (!canEditProject(permission)) return NextResponse.json({ error: 'Viewer access cannot run audits' }, { status: 403 })

    const projectHost = new URL(project.website_url).hostname.replace(/^www\./, '')
    const auditHost = new URL(auditUrl).hostname.replace(/^www\./, '')
    if (projectHost !== auditHost) {
      return NextResponse.json({ error: 'Audit URL must use the selected project’s website domain' }, { status: 400 })
    }

    const audit = await auditLandingPage(auditUrl, project.business_analysis)

    const { error: updateError } = await adminClient
      .from('projects')
      .update({ landing_audit: audit, updated_at: new Date().toISOString() })
      .eq('id', project_id)
      .eq('user_id', project.user_id)
    if (updateError) throw new Error(updateError.message)

    return NextResponse.json({ success: true, audit })
  } catch (error) {
    console.error('Landing audit error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Audit failed' }, { status: 500 })
  }
}
