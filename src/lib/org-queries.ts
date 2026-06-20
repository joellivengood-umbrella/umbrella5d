import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchProgramSlugs } from './course-queries'

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
 * Per-member completed-item count for the Team Progress section on the
 * My Organization page. Counts only Umbrella Program items (BSS + EOS + Machine);
 * bonus Daily Pod episodes are excluded, matching each member's own
 * sidebar/dashboard progress.
 */
export type TeamProgressRow = {
  userId: string
  completed: number
}

/**
 * Returns one TeamProgressRow per provided user_id, counting only
 * in-program completions (courses.in_program — data-driven, so a new
 * promoted course is counted and a bonus course is not). Users with zero
 * completions are included with completed=0 so every team member shows up
 * in the progress list, not just the active ones.
 *
 * Scopes to the same in_program slug set the member's own dashboard uses,
 * so the manager view and the member view of program progress agree
 * (previously this counted everything-except-POTD, inflating the count).
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

  // No in-program courses → everyone is at 0 (avoids .in('type', []) which
  // would match nothing anyway, but keeps every requested user in the result).
  const programSlugs = await fetchProgramSlugs(supabase)
  if (programSlugs.length === 0) {
    return userIds.map((userId) => ({ userId, completed: 0 }))
  }

  const { data, error } = await supabase
    .from('content_progress')
    .select(
      'user_id, content_items!inner(type, is_published)'
    )
    .in('user_id', userIds)
    .in('content_items.type', programSlugs)

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

    // Skip unpublished items (admin pulled them after the user completed
    // them). Non-program courses are already filtered server-side via .in.
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

/**
 * One team<->course assignment edge, camel-cased. courseSlug is a course
 * slug from the src/lib/courses.ts registry (e.g. "bss", "machine").
 */
export type TeamCourseAssignment = {
  teamId: string
  courseSlug: string
}

/**
 * Every team<->course assignment in the org, so the manager UI knows
 * which courses each team already has.
 *
 * RLS: manager-only via the "managers read team course assignments"
 * policy — the My Organization page is manager-gated. (Members read only
 * their own teams' rows, via a separate policy, for the dashboard view.)
 */
export async function fetchTeamCourseAssignments(
  supabase: MaybeClient,
  orgId: string
): Promise<TeamCourseAssignment[]> {
  const { data, error } = await supabase
    .from('team_course_assignments')
    .select('team_id, course_slug')
    .eq('org_id', orgId)

  if (error) {
    // Degrade to "no assignments" rather than throw — the migration that
    // creates this table runs AFTER the code deploys, so a missing table
    // must not 500 the whole (manager-gated) My Organization page in that
    // window. Logged so a genuine failure is still visible server-side.
    console.error('fetchTeamCourseAssignments error', error)
    return []
  }

  return (data ?? []).map((row) => ({
    teamId: (row as { team_id: string }).team_id,
    courseSlug: (row as { course_slug: string }).course_slug,
  }))
}

/**
 * The distinct course slugs assigned to teams the given user belongs to —
 * the "required for your team" set for the member dashboard.
 *
 * Scoped EXPLICITLY to the user's own team memberships: a manager can read
 * every team's assignments via the manager RLS policy, so relying on RLS
 * alone would show a manager ALL their org's assignments. We fetch the
 * user's teams first, then their assignments. Degrades to [] on error
 * (e.g. before the 20260614 migration has run), so it can't break the
 * dashboard.
 */
export async function fetchRequiredCourseSlugs(
  supabase: MaybeClient,
  userId: string
): Promise<string[]> {
  const { data: memberships, error: mErr } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
  if (mErr) {
    console.error('fetchRequiredCourseSlugs (team_members) error', mErr)
    return []
  }
  const teamIds = (memberships ?? []).map(
    (r) => (r as { team_id: string }).team_id
  )
  if (teamIds.length === 0) return []

  const { data, error } = await supabase
    .from('team_course_assignments')
    .select('course_slug')
    .in('team_id', teamIds)
  if (error) {
    console.error('fetchRequiredCourseSlugs (assignments) error', error)
    return []
  }

  const slugs = new Set<string>()
  for (const row of data ?? []) {
    slugs.add((row as { course_slug: string }).course_slug)
  }
  return [...slugs]
}

/**
 * A partner the current user owns. (Single-owner model for now.)
 */
export type Partner = {
  id: string
  name: string
  inviteCode: string
  avatarUrl: string | null
  description: string | null
}

/**
 * The partner the given user owns, or null. Drives the Partner nav tab +
 * the onboarding-skip in the (app) layout. order().limit(1) rather than
 * .maybeSingle() so an (unexpected) second owned partner can't throw
 * PGRST116. Degrades to null on error so it never breaks page render.
 */
export async function fetchUserPartner(
  supabase: MaybeClient,
  userId: string
): Promise<Partner | null> {
  const { data, error } = await supabase
    .from('partners')
    .select('id, name, invite_code, avatar_url, description')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (error) {
    console.error('fetchUserPartner error', error)
    return null
  }
  const row = (data ?? [])[0] as
    | {
        id: string
        name: string
        invite_code: string
        avatar_url: string | null
        description: string | null
      }
    | undefined
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    avatarUrl: row.avatar_url,
    description: row.description,
  }
}

/**
 * One organization owned by a partner, for the Partner home list.
 */
export type PartnerOrg = {
  id: string
  name: string
  createdAt: string
}

/**
 * Organizations owned by the caller's partner, alphabetical. Reads through
 * the list_partner_orgs definer RPC, which returns only safe columns
 * (id/name/created_at) — never the owned orgs' invite_code/owner_id, which
 * a full-row table policy would have leaked. Degrades to [] on error (e.g.
 * before the RPC migration has run).
 */
export async function fetchPartnerOrgs(
  supabase: MaybeClient
): Promise<PartnerOrg[]> {
  const { data, error } = await supabase.rpc('list_partner_orgs')

  if (error) {
    console.error('fetchPartnerOrgs error', error)
    return []
  }
  return ((data ?? []) as { id: string; name: string; created_at: string }[]).map(
    (row) => ({ id: row.id, name: row.name, createdAt: row.created_at })
  )
}

/**
 * The branding (name/logo/description) of the partner that owns the caller's
 * organization — the "Provided by …" co-brand shown to members.
 */
export type PartnerBranding = {
  name: string
  avatarUrl: string | null
  description: string | null
}

/**
 * The partner branding for the caller's own organization, or null if their
 * org has no partner (or they have no org). Reads through the
 * get_my_partner_branding definer RPC: a member can't SELECT the partners
 * table directly (RLS limits it to the owner/admin), so the RPC returns ONLY
 * safe display columns for their own org's partner. Degrades to null on error
 * (e.g. before the RPC migration has run) so it never breaks page render.
 */
export async function fetchMyPartnerBranding(
  supabase: MaybeClient
): Promise<PartnerBranding | null> {
  const { data, error } = await supabase.rpc('get_my_partner_branding')
  if (error) {
    console.error('fetchMyPartnerBranding error', error)
    return null
  }
  const row = (data ?? [])[0] as
    | { name: string; avatar_url: string | null; description: string | null }
    | undefined
  if (!row) return null
  return {
    name: row.name,
    avatarUrl: row.avatar_url,
    description: row.description,
  }
}

// POTD launch / daily-drip removed — every published episode is
// available to everyone now. fetchOrgPotdLaunch lived here; if the
// staggered-release feature comes back, re-add it (the
// org_potd_launches table is left dormant in the DB).
