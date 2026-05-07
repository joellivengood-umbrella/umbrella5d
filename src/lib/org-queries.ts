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
 * Per-member completed-item count for the Team Progress section on
 * /team. Counts only items the user can actually access (i.e. excludes
 * POTD episodes beyond the org's current unlock window) so the
 * percentages match what each member sees in their own sidebar.
 */
export type TeamProgressRow = {
  userId: string
  completed: number
}

/**
 * Returns one TeamProgressRow per provided user_id. Users with zero
 * completions are included with completed=0 — every team member shows
 * up in the progress list, not just the active ones.
 *
 * RLS requirement: the caller must be a manager of an org that the
 * provided user_ids are members of. Without the
 * "managers can view team progress" policy
 * (20260428_managers_view_team_progress.sql), this returns nothing.
 */
export async function fetchTeamProgress(
  supabase: MaybeClient,
  userIds: string[],
  unlockedThroughDay: number
): Promise<TeamProgressRow[]> {
  if (userIds.length === 0) return []

  const { data, error } = await supabase
    .from('content_progress')
    .select(
      'user_id, content_items!inner(type, sequence_num, is_published)'
    )
    .in('user_id', userIds)

  if (error) {
    console.error('fetchTeamProgress error', error)
    throw new Error(`fetchTeamProgress failed: ${error.message}`)
  }

  // Initialize every user with 0 so members with no completions still
  // get a row.
  const counts = new Map<string, number>()
  for (const id of userIds) counts.set(id, 0)

  for (const row of data ?? []) {
    const userId = (row as { user_id: string }).user_id

    // Supabase types embedded relations as object-or-array. Normalize.
    const rawItem = (row as {
      content_items:
        | { type: string; sequence_num: number; is_published: boolean }
        | { type: string; sequence_num: number; is_published: boolean }[]
        | null
    }).content_items
    const item = Array.isArray(rawItem) ? rawItem[0] : rawItem
    if (!item) continue

    // Skip unpublished items (admin pulled them after the user
    // completed them) and out-of-window POTD episodes (matches the
    // accessible-totals math the sidebar/dashboard use).
    if (!item.is_published) continue
    if (item.type === 'potd' && item.sequence_num > unlockedThroughDay) {
      continue
    }

    counts.set(userId, (counts.get(userId) ?? 0) + 1)
  }

  return Array.from(counts.entries()).map(([userId, completed]) => ({
    userId,
    completed,
  }))
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
