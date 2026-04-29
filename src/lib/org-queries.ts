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
  // .maybeSingle() returns { data: null, error: null } when there's no
  // matching row, so any non-null error is a real failure (network,
  // permissions, duplicate rows). Bubble it up rather than masquerading
  // as "not a member" — the Next.js error boundary handles the rest.
  if (error) {
    console.error('fetchUserOrgRole error', error)
    throw new Error(`fetchUserOrgRole failed: ${error.message}`)
  }
  if (!data) return null
  const role = (data as { role: string }).role
  if (role === 'manager' || role === 'member') return role
  return null
}

/**
 * One row per member returned by fetchOrgMembers. Camel-cased and
 * pre-resolved so the UI doesn't need to deal with the joined-relation
 * shape Supabase returns.
 */
export type OrgMember = {
  userId: string
  fullName: string | null
  avatarUrl: string | null
  role: OrgRole
  joinedAt: string // ISO timestamp from org_members.created_at
}

/**
 * Roster for a manager's team page. Returns every member of the given
 * org, joined to their profile (name + avatar). Ordered managers-first,
 * then alphabetically by name so the manager's own row tends to be at
 * the top.
 *
 * Requires the caller to actually be a manager of the org — RLS
 * enforces it. The "managers can view all org members" SELECT policy
 * lets the manager read every org_members row, and the
 * "managers can view team profiles" policy (added in
 * 20260428_managers_view_team_profiles.sql) lets them read each
 * member's profile.
 */
export async function fetchOrgMembers(
  supabase: MaybeClient,
  orgId: string
): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from('org_members')
    .select(
      'user_id, role, created_at, profiles!inner(full_name, avatar_url)'
    )
    .eq('org_id', orgId)
    .order('role', { ascending: true }) // managers ('manager') sort before members ('member') alphabetically
    .order('created_at', { ascending: true })

  if (error) {
    console.error('fetchOrgMembers error', error)
    throw new Error(`fetchOrgMembers failed: ${error.message}`)
  }

  return (data ?? []).map((row) => {
    // Supabase types embedded relations as either an object or an array.
    // org_members -> profiles is many-to-one (each member has one
    // profile), so this is normally an object — but normalize defensively.
    const rawProfile = (row as {
      profiles: { full_name: string | null; avatar_url: string | null }
        | { full_name: string | null; avatar_url: string | null }[]
        | null
    }).profiles
    const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile

    const role = (row as { role: string }).role
    return {
      userId: (row as { user_id: string }).user_id,
      fullName: profile?.full_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      role: role === 'manager' ? 'manager' : 'member',
      joinedAt: (row as { created_at: string }).created_at,
    }
  })
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
  // Same reasoning as fetchUserOrgRole: .maybeSingle() already handles
  // the "no launch row yet" case via { data: null, error: null }, so a
  // real error must not be silently flattened into "POTD not launched."
  if (error) {
    console.error('fetchOrgPotdLaunch error', error)
    throw new Error(`fetchOrgPotdLaunch failed: ${error.message}`)
  }
  if (!data) return null
  return {
    launchedAt: (data as { launched_at: string }).launched_at,
    launchedBy:
      ((data as { launched_by: string | null }).launched_by ?? null) || null,
  }
}
