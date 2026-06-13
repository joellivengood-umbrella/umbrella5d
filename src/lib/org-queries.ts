import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side reads against organizations / org_members.
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
  // org_members.user_id and profiles.id both reference auth.users, with NO
  // direct foreign key between the two tables — so PostgREST cannot embed
  // profiles (it errors PGRST200, "no relationship in the schema cache").
  // Fetch the members, then their profiles, and join in memory.
  const { data: memberData, error } = await supabase
    .from('org_members')
    .select('user_id, role, created_at')
    .eq('org_id', orgId)
    .order('role', { ascending: true }) // managers ('manager') sort before members ('member') alphabetically
    .order('created_at', { ascending: true })

  if (error) {
    console.error('fetchOrgMembers error', error)
    throw new Error(`fetchOrgMembers failed: ${error.message}`)
  }

  const memberRows = (memberData ?? []) as {
    user_id: string
    role: string
    created_at: string
  }[]
  if (memberRows.length === 0) return []

  // Manager reads each member's profile via the "managers can view team
  // profiles" RLS policy (is_managed_team_member), and their own via the
  // own-row policy — so every org member's profile is visible here.
  const { data: profileData, error: profileErr } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', memberRows.map((r) => r.user_id))

  if (profileErr) {
    console.error('fetchOrgMembers profiles error', profileErr)
    throw new Error(`fetchOrgMembers failed: ${profileErr.message}`)
  }

  const profileById = new Map(
    (
      (profileData ?? []) as {
        id: string
        full_name: string | null
        avatar_url: string | null
      }[]
    ).map((p) => [p.id, p])
  )

  return memberRows.map((row) => {
    const profile = profileById.get(row.user_id)
    return {
      userId: row.user_id,
      fullName: profile?.full_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      role: row.role === 'manager' ? 'manager' : 'member',
      joinedAt: row.created_at,
    }
  })
}

/**
 * Per-member completed-item count for the Team Progress section on
 * /team. Counts only Umbrella Program items (BSS + EOS + Machine);
 * bonus Daily Pod episodes are excluded, matching each member's own
 * sidebar/dashboard progress.
 */
export type TeamProgressRow = {
  userId: string
  completed: number
}

/**
 * Returns one TeamProgressRow per provided user_id, counting only
 * Umbrella Program completions (BSS, EOS, Machine — POTD excluded).
 * Users with zero completions are included with completed=0 so every
 * team member shows up in the progress list, not just the active ones.
 *
 * POTD is bonus content; its completions don't count toward program
 * progress. Filter is server-side via the embedded-table .neq.
 *
 * RLS requirement: the caller must be a manager of an org that the
 * provided user_ids are members of, via the
 * "managers can view team progress" policy.
 */
export async function fetchTeamProgress(
  supabase: MaybeClient,
  userIds: string[]
): Promise<TeamProgressRow[]> {
  if (userIds.length === 0) return []

  const { data, error } = await supabase
    .from('content_progress')
    .select(
      'user_id, content_items!inner(type, is_published)'
    )
    .in('user_id', userIds)
    .neq('content_items.type', 'potd')

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
        | { type: string; is_published: boolean }
        | { type: string; is_published: boolean }[]
        | null
    }).content_items
    const item = Array.isArray(rawItem) ? rawItem[0] : rawItem
    if (!item) continue

    // Skip unpublished items (admin pulled them after the user
    // completed them). POTD is already filtered server-side.
    if (!item.is_published) continue

    counts.set(userId, (counts.get(userId) ?? 0) + 1)
  }

  return Array.from(counts.entries()).map(([userId, completed]) => ({
    userId,
    completed,
  }))
}

/**
 * One row from content_assignments, with the joined content_item
 * details flattened so the UI can render without dealing with
 * Supabase's embedded-relation shape.
 */
export type AssignmentEntry = {
  id: string
  contentItemId: string
  type: 'bss' | 'eos' | 'potd' | 'machine'
  sequenceNum: number
  title: string | null
  metadataVersion: string | null // BSS version slug, otherwise null
  assignedAt: string
}

/**
 * All assignments for a single member, joined to content_items so the
 * UI can show "BSS 5hr · Segment 4: Title" without a second round-trip.
 *
 * RLS: managers can read these via "managers read team assignments";
 * the assignee themselves can read via "users read own assignments".
 * Order: most recently assigned first, so a manager scanning the list
 * sees their latest action at the top.
 */
export async function fetchMemberAssignments(
  supabase: MaybeClient,
  userId: string
): Promise<AssignmentEntry[]> {
  const { data, error } = await supabase
    .from('content_assignments')
    .select(
      'id, content_item_id, assigned_at, content_items!inner(type, sequence_num, title, metadata)'
    )
    .eq('user_id', userId)
    .order('assigned_at', { ascending: false })

  if (error) {
    console.error('fetchMemberAssignments error', error)
    throw new Error(`fetchMemberAssignments failed: ${error.message}`)
  }

  return (data ?? []).map((row) => {
    const rawItem = (row as {
      content_items:
        | {
            type: string
            sequence_num: number
            title: string | null
            metadata: Record<string, unknown> | null
          }
        | {
            type: string
            sequence_num: number
            title: string | null
            metadata: Record<string, unknown> | null
          }[]
        | null
    }).content_items
    const item = Array.isArray(rawItem) ? rawItem[0] : rawItem

    const type = (item?.type ?? 'bss') as
      | 'bss'
      | 'eos'
      | 'potd'
      | 'machine'
    const meta = (item?.metadata ?? {}) as { version?: string }

    return {
      id: (row as { id: string }).id,
      contentItemId: (row as { content_item_id: string }).content_item_id,
      type,
      sequenceNum: item?.sequence_num ?? 0,
      title: item?.title ?? null,
      metadataVersion: type === 'bss' ? (meta.version ?? null) : null,
      assignedAt: (row as { assigned_at: string }).assigned_at,
    }
  })
}

/**
 * A team (named sub-group) within an organization.
 */
export type Team = {
  id: string
  name: string
  createdAt: string
}

/**
 * One person<->team edge from team_members, camel-cased.
 */
export type TeamMembership = {
  teamId: string
  userId: string
}

/**
 * Every team in the given org, ordered alphabetically by name.
 *
 * RLS: manager-only via the "managers read teams" policy on
 * public.teams — the My Organization page is manager-gated.
 */
export async function fetchTeams(
  supabase: MaybeClient,
  orgId: string
): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, created_at')
    .eq('org_id', orgId)
    .order('name', { ascending: true })

  if (error) {
    console.error('fetchTeams error', error)
    throw new Error(`fetchTeams failed: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: (row as { id: string }).id,
    name: (row as { name: string }).name,
    createdAt: (row as { created_at: string }).created_at,
  }))
}

/**
 * Every person<->team membership edge in the org, so the roster can
 * render each member's team chips without an N+1 query. The page joins
 * these against fetchOrgMembers / fetchTeams in memory.
 *
 * RLS: manager-only via the "managers read team members" policy on
 * public.team_members.
 */
export async function fetchTeamMemberships(
  supabase: MaybeClient,
  orgId: string
): Promise<TeamMembership[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id, user_id')
    .eq('org_id', orgId)

  if (error) {
    console.error('fetchTeamMemberships error', error)
    throw new Error(`fetchTeamMemberships failed: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    teamId: (row as { team_id: string }).team_id,
    userId: (row as { user_id: string }).user_id,
  }))
}

// POTD launch / daily-drip removed — every published episode is
// available to everyone now. fetchOrgPotdLaunch lived here; if the
// staggered-release feature comes back, re-add it (the
// org_potd_launches table is left dormant in the DB).
