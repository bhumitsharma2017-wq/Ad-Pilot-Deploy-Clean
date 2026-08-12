import type { SupabaseClient } from '@supabase/supabase-js'
import type { Project } from '@/types'

export type ProjectPermission = 'owner' | 'admin' | 'member' | 'viewer' | null

export type AccessibleProject = Project

export function canEditProject(permission: ProjectPermission) {
  return permission === 'owner' || permission === 'admin' || permission === 'member'
}

/**
 * Authorizes owner and active Agency team members against a project. All
 * application routes use this with the service client, rather than trusting a
 * project ID sent by the browser.
 */
export async function getProjectAccess(
  adminClient: SupabaseClient,
  userId: string,
  projectId: string
): Promise<{ project: AccessibleProject | null; permission: ProjectPermission }> {
  const { data: project } = await adminClient
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle()

  if (!project) return { project: null, permission: null }
  if (project.user_id === userId) return { project: project as AccessibleProject, permission: 'owner' }

  const { data: membership } = await adminClient
    .from('team_members')
    .select('role, accepted_at')
    .eq('owner_id', project.user_id)
    .eq('member_id', userId)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  const permission = membership?.role
  if (permission !== 'admin' && permission !== 'member' && permission !== 'viewer') {
    return { project: null, permission: null }
  }

  return { project: project as AccessibleProject, permission }
}
