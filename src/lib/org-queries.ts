import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side reads against organizations / org_members / org_potd_launches.
 * Kept separate from content-queries.ts because org/role concerns are
 * orthogonal to course content.
 */

type MaybeClient = SupabaseClient

export type OrgRole = 'manager' | 'member'

/**
 * The current user's role inside the given org, or null if not a member.
 * Reads through the existing RLS on org_members (members can see their
 * own row at minimum).
 */
export async function fetchUserOrgRole(
  supabase: MaybeClient,
  userId: string,
  orgId: string
): Promise<OrgRole | null> {
  const { data, error } = await supabase
    .from('org_members')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) {
    console.error('fetchUserOrgRole error', error)
    return null
  }
  if (!data) return null
  const role = (data as { role: string }).role
  if (role === 'manager' || role === 'member') return role
  return null
}

/**
 * The org's POTD launch row, or null if POTD hasn't been launched yet.
 * Returns the launch timestamp as an ISO string for easy serialization
 * across server -> client component boundaries.
 */
export async function fetchOrgPotdLaunch(
  supabase: MaybeClient,
  orgId: string
): Promise<{ launchedAt: string; launchedBy: string | null } | null> {
  const { data, error } = await supabase
    .from('org_potd_launches')
    .select('launched_at, launched_by')
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) {
    console.error('fetchOrgPotdLaunch error', error)
    return null
  }
  if (!data) return null
  return {
    launchedAt: (data as { launched_at: string }).launched_at,
    launchedBy:
      ((data as { launched_by: string | null }).launched_by ?? null) || null,
  }
}
