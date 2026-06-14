'use client'

import { useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UMBRELLA_PROGRAM_COURSES } from '@/lib/courses'
import type {
  OrgMember,
  Team,
  TeamMembership,
  TeamCourseAssignment,
} from '@/lib/org-queries'

/**
 * The interactive "My Organization" workspace (team-first).
 *
 * Left: the Teams list — create a team, rename or delete it, and click
 * one to open it.
 *
 * Right: the selected team's roster. A search field finds anyone in the
 * org and adds them in one click (it stays put for rapid adds); each
 * current member has an × to remove them. You manage one team's
 * membership at a time, which scales cleanly to large orgs because the
 * search is the primary action — you never scroll the whole roster.
 *
 * A person can be on several teams (many-to-many). All writes go straight
 * from the browser client and are authorized by the teams / team_members
 * RLS policies (manager-only, org-scoped); the UI updates optimistically
 * and rolls back on error.
 */

// A small fixed palette. Each team's color is keyed to its CREATION order
// (see colorForTeam), so adding/renaming a team never reshuffles the
// colors of the teams already there — a new team just takes the next one.
const TEAM_COLORS = [
  { dot: '#5b4fff', bg: '#EEEDFE', text: '#3C3489' }, // indigo (brand)
  { dot: '#1D9E75', bg: '#E1F5EE', text: '#0F6E56' }, // teal
  { dot: '#BA7517', bg: '#FAEEDA', text: '#854F0B' }, // amber
  { dot: '#D4537E', bg: '#FBEAF0', text: '#72243E' }, // pink
  { dot: '#378ADD', bg: '#E6F1FB', text: '#0C447C' }, // blue
  { dot: '#D85A30', bg: '#FAECE7', text: '#993C1D' }, // coral
  { dot: '#639922', bg: '#EAF3DE', text: '#3B6D11' }, // green
  { dot: '#888780', bg: '#F1EFE8', text: '#444441' }, // gray
] as const

const edgeKey = (teamId: string, userId: string) => `${teamId}::${userId}`
const courseKey = (teamId: string, slug: string) => `${teamId}::${slug}`

// The courses a manager can assign — the three core program courses
// (POTD is excluded; it stays available to everyone). Registry-driven, so
// adding a course later makes it assignable with no change here.
const COURSE_OPTIONS = UMBRELLA_PROGRAM_COURSES.map((c) => ({
  slug: c.slug,
  title: c.title,
}))

// Cap the search results so a big org never renders a giant list.
const MAX_RESULTS = 8

type Status = { type: 'success' | 'error'; msg: string } | null

export function OrgTeamsManager({
  orgId,
  currentUserId,
  members,
  initialTeams,
  initialMemberships,
  initialCourseAssignments,
}: {
  orgId: string
  currentUserId: string
  members: OrgMember[]
  initialTeams: Team[]
  initialMemberships: TeamMembership[]
  initialCourseAssignments: TeamCourseAssignment[]
}) {
  const supabase = useMemo(() => createClient(), [])

  const [teams, setTeams] = useState<Team[]>(initialTeams)
  // person<->team edges as a Set of "teamId::userId" for O(1) lookup.
  const [edges, setEdges] = useState<Set<string>>(
    () => new Set(initialMemberships.map((m) => edgeKey(m.teamId, m.userId)))
  )
  // team<->course assignment edges as a Set of "teamId::slug".
  const [courseEdges, setCourseEdges] = useState<Set<string>>(
    () =>
      new Set(
        initialCourseAssignments.map((a) => courseKey(a.teamId, a.courseSlug))
      )
  )
  const [busyCourses, setBusyCourses] = useState<Set<string>>(new Set())
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    initialTeams[0]?.id ?? null
  )
  const [busyEdges, setBusyEdges] = useState<Set<string>>(new Set())
  const [teamBusy, setTeamBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const [newTeamName, setNewTeamName] = useState('')
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [addSearch, setAddSearch] = useState('')

  // Guards a rename so the input's onBlur (which fires when the field
  // unmounts after Enter/Escape) doesn't commit a second time — and so
  // Escape truly cancels instead of saving the edited value.
  const renameDoneRef = useRef(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const detailRef = useRef<HTMLElement>(null)

  // Consistency model: local optimistic state is authoritative for this
  // session. We deliberately do NOT re-seed from props after writes —
  // wholesale-replacing teams/edges mid-session races with in-flight
  // optimistic updates (a just-added member could blink out). A change
  // made by another manager surfaces on the next page load, when the
  // server component re-mounts with fresh props. (Same approach as
  // MachinePartsManager.)

  // Teams sorted by name for display (state order is irrelevant).
  const teamsByName = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams]
  )

  // STABLE color: index a team by its position in CREATION order. Adding
  // a team appends to the end of that order (newest createdAt) so it gets
  // the next color and every existing team keeps its own.
  const colorIndexByTeamId = useMemo(() => {
    const ordered = [...teams].sort((a, b) =>
      a.createdAt < b.createdAt
        ? -1
        : a.createdAt > b.createdAt
          ? 1
          : a.id.localeCompare(b.id)
    )
    const map = new Map<string, number>()
    ordered.forEach((t, i) => map.set(t.id, i))
    return map
  }, [teams])
  const colorForTeam = (teamId: string) =>
    TEAM_COLORS[(colorIndexByTeamId.get(teamId) ?? 0) % TEAM_COLORS.length]

  // Per-team member counts, computed once per render rather than an
  // O(members) scan inside every team row.
  const countByTeamId = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of teams) map.set(t.id, 0)
    for (const m of members) {
      for (const t of teams) {
        if (edges.has(edgeKey(t.id, m.userId))) {
          map.set(t.id, (map.get(t.id) ?? 0) + 1)
        }
      }
    }
    return map
  }, [teams, members, edges])

  // Resolve the open team, falling back to the first team so the right
  // panel is never blank while teams exist. selectedTeam is null only when
  // there are no teams at all.
  const selectedTeam =
    teams.find((t) => t.id === selectedTeamId) ?? teams[0] ?? null
  const activeTeamId = selectedTeam?.id ?? null

  const teamMembers = useMemo(
    () =>
      activeTeamId
        ? members.filter((m) => edges.has(edgeKey(activeTeamId, m.userId)))
        : [],
    [activeTeamId, members, edges]
  )
  const availableMembers = useMemo(
    () =>
      activeTeamId
        ? members.filter((m) => !edges.has(edgeKey(activeTeamId, m.userId)))
        : [],
    [activeTeamId, members, edges]
  )

  const addQuery = addSearch.trim().toLowerCase()
  // Empty query lists everyone available (so a person with no name set is
  // still reachable); a query filters by name. Always capped.
  const filteredAdd = useMemo(
    () =>
      addQuery
        ? availableMembers.filter((m) =>
            (m.fullName ?? '').toLowerCase().includes(addQuery)
          )
        : availableMembers,
    [availableMembers, addQuery]
  )
  const shownAdd = filteredAdd.slice(0, MAX_RESULTS)

  function selectTeam(id: string) {
    setSelectedTeamId(id)
    setAddSearch('')
    setStatus(null)
    // On a narrow (stacked) layout, bring the now-open roster into view.
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // ── Create a team ──────────────────────────────────────────────
  async function createTeam(e: React.FormEvent) {
    e.preventDefault()
    const name = newTeamName.trim()
    if (!name || teamBusy) return
    if (teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setStatus({ type: 'error', msg: `A team called “${name}” already exists.` })
      return
    }
    setTeamBusy(true)
    setStatus(null)
    const { data, error } = await supabase
      .from('teams')
      .insert({ org_id: orgId, name })
      .select('id, name, created_at')
      .single()
    setTeamBusy(false)

    if (error || !data) {
      if (error?.code === '23505') {
        setStatus({ type: 'error', msg: `A team called “${name}” already exists.` })
      } else {
        console.error('createTeam error', error)
        setStatus({ type: 'error', msg: 'Could not create the team. Please try again.' })
      }
      return
    }

    const created: Team = {
      id: data.id as string,
      name: data.name as string,
      createdAt: data.created_at as string,
    }
    setTeams((prev) => [...prev, created])
    setNewTeamName('')
    setSelectedTeamId(created.id) // open the new team straight away
    setAddSearch('')
    setStatus({ type: 'success', msg: `“${created.name}” team created.` })
  }

  // ── Rename a team (inline) ──────────────────────────────────────
  function startRename(team: Team) {
    setStatus(null)
    renameDoneRef.current = false
    setEditingTeamId(team.id)
    setEditingName(team.name)
  }

  // Escape backs out without saving. Marks the rename done so the
  // unmount-triggered onBlur → commitRename no-ops instead of committing
  // the abandoned edit.
  function cancelRename() {
    renameDoneRef.current = true
    setEditingTeamId(null)
  }

  async function commitRename(team: Team) {
    // Re-entrancy guard: Enter (or blur) commits once; the subsequent
    // onBlur fired by the field unmounting must not commit again.
    if (renameDoneRef.current) return
    renameDoneRef.current = true
    setEditingTeamId(null)

    const name = editingName.trim()
    if (!name || name === team.name) return
    if (
      teams.some(
        (t) => t.id !== team.id && t.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      setStatus({ type: 'error', msg: `A team called “${name}” already exists.` })
      return
    }

    const prev = teams
    setTeams((ts) => ts.map((t) => (t.id === team.id ? { ...t, name } : t)))
    const { error } = await supabase.from('teams').update({ name }).eq('id', team.id)
    if (error) {
      setTeams(prev) // rollback
      if (error.code === '23505') {
        setStatus({ type: 'error', msg: `A team called “${name}” already exists.` })
      } else {
        console.error('renameTeam error', error)
        setStatus({ type: 'error', msg: 'Could not rename the team.' })
      }
      return
    }
    setStatus({ type: 'success', msg: `Renamed to “${name}”.` })
  }

  // ── Delete a team ───────────────────────────────────────────────
  async function deleteTeam(team: Team) {
    if (
      !window.confirm(
        `Delete the “${team.name}” team? Its members stay in your organization but lose this team.`
      )
    ) {
      return
    }

    const prevTeams = teams
    const prevEdges = edges
    const prevSelected = selectedTeamId
    setTeams((ts) => ts.filter((t) => t.id !== team.id))
    setEdges((es) => {
      const n = new Set(es)
      for (const m of members) n.delete(edgeKey(team.id, m.userId))
      return n
    })
    if (selectedTeamId === team.id) {
      // Move selection to a concrete surviving team (name-order), so the
      // open team is explicit rather than an implicit teams[0] fallback.
      const survivor = teamsByName.find((t) => t.id !== team.id) ?? null
      setSelectedTeamId(survivor?.id ?? null)
      setAddSearch('')
    }

    // team_members rows cascade-delete in the DB via the team_id FK.
    const { error } = await supabase.from('teams').delete().eq('id', team.id)
    if (error) {
      setTeams(prevTeams) // rollback
      setEdges(prevEdges)
      setSelectedTeamId(prevSelected)
      console.error('deleteTeam error', error)
      setStatus({ type: 'error', msg: 'Could not delete the team.' })
      return
    }
    setStatus({ type: 'success', msg: `“${team.name}” team deleted.` })
  }

  // ── Add / remove a member ↔ team ────────────────────────────────
  async function addToTeam(teamId: string, userId: string) {
    const key = edgeKey(teamId, userId)
    if (edges.has(key) || busyEdges.has(key)) return
    setStatus(null)
    setBusyEdges((b) => new Set(b).add(key))
    setEdges((es) => new Set(es).add(key)) // optimistic
    // Keep the user in the add loop: the clicked result row unmounts, so
    // return focus to the search field.
    searchInputRef.current?.focus()

    const { error } = await supabase.from('team_members').insert({
      org_id: orgId,
      team_id: teamId,
      user_id: userId,
      added_by: currentUserId,
    })

    // 23505 = already on the team (another tab/manager beat us). The
    // optimistic edge is already correct, so treat it as success.
    if (error && error.code !== '23505') {
      setEdges((es) => {
        const n = new Set(es)
        n.delete(key)
        return n
      }) // rollback FIRST, then release the busy guard
      console.error('addToTeam error', error)
      setStatus({ type: 'error', msg: 'Could not add to the team. Please try again.' })
    }

    setBusyEdges((b) => {
      const n = new Set(b)
      n.delete(key)
      return n
    })
  }

  async function removeFromTeam(teamId: string, userId: string) {
    const key = edgeKey(teamId, userId)
    if (busyEdges.has(key)) return
    setStatus(null)
    setBusyEdges((b) => new Set(b).add(key))
    setEdges((es) => {
      const n = new Set(es)
      n.delete(key)
      return n
    }) // optimistic

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .eq('org_id', orgId)

    if (error) {
      setEdges((es) => new Set(es).add(key)) // rollback FIRST, then release busy
      console.error('removeFromTeam error', error)
      setStatus({ type: 'error', msg: 'Could not remove from the team. Please try again.' })
    }

    setBusyEdges((b) => {
      const n = new Set(b)
      n.delete(key)
      return n
    })
  }

  // ── Assign / unassign a course to the selected team ─────────────
  async function toggleCourse(teamId: string, slug: string, assigned: boolean) {
    const key = courseKey(teamId, slug)
    if (busyCourses.has(key)) return
    setStatus(null)
    setBusyCourses((b) => new Set(b).add(key))
    setCourseEdges((es) => {
      const n = new Set(es)
      if (assigned) n.delete(key)
      else n.add(key)
      return n
    }) // optimistic

    const { error } = assigned
      ? await supabase
          .from('team_course_assignments')
          .delete()
          .eq('team_id', teamId)
          .eq('course_slug', slug)
          .eq('org_id', orgId)
      : await supabase.from('team_course_assignments').insert({
          org_id: orgId,
          team_id: teamId,
          course_slug: slug,
          assigned_by: currentUserId,
        })

    // 23505 on insert = already assigned (another tab/manager beat us);
    // the optimistic edge is already correct, so treat it as success.
    if (error && !(!assigned && error.code === '23505')) {
      setCourseEdges((es) => {
        const n = new Set(es)
        if (assigned) n.add(key)
        else n.delete(key)
        return n
      }) // rollback FIRST, then release the busy guard
      console.error('toggleCourse error', error)
      setStatus({
        type: 'error',
        msg: 'Could not update the assigned courses. Please try again.',
      })
    }

    setBusyCourses((b) => {
      const n = new Set(b)
      n.delete(key)
      return n
    })
  }

  // Enter in the search field adds the top match — the advertised
  // rapid-add flow, keyboard-operable.
  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && shownAdd.length > 0 && selectedTeam) {
      e.preventDefault()
      addToTeam(selectedTeam.id, shownAdd[0].userId)
    }
  }

  return (
    <>
      {/* Single status banner above both columns — visible (and announced
          to screen readers) no matter which column triggered it. */}
      {status && (
        <p
          className={`settings-status settings-status--${status.type} org-status`}
          role={status.type === 'error' ? 'alert' : 'status'}
          aria-live={status.type === 'error' ? 'assertive' : 'polite'}
        >
          {status.msg}
        </p>
      )}

      <div className="org-grid">
        {/* ── Left: Teams ── */}
        <section className="settings-section org-panel">
          <header className="settings-section__header">
            <h2>Teams</h2>
            <p>
              {teams.length} {teams.length === 1 ? 'team' : 'teams'}
              {teams.length > 0 ? ' · pick one to manage its people' : ''}.
            </p>
          </header>

          <form className="org-newteam" onSubmit={createTeam}>
            <input
              className="org-newteam__input"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="New team name…"
              maxLength={60}
              aria-label="New team name"
            />
            <button
              type="submit"
              className="btn btn--primary"
              disabled={teamBusy || !newTeamName.trim()}
            >
              {teamBusy ? 'Creating…' : 'Create'}
            </button>
          </form>

          <ul className="org-teams">
            {teamsByName.map((t) => {
              const c = colorForTeam(t.id)
              const isSelected = activeTeamId === t.id
              const isEditing = editingTeamId === t.id
              return (
                <li
                  key={t.id}
                  className={`org-team${isSelected ? ' is-selected' : ''}`}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      className="org-team__editinput"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => commitRename(t)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          commitRename(t)
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          cancelRename()
                        }
                      }}
                      maxLength={60}
                      aria-label={`Rename ${t.name}`}
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        className="org-team__select"
                        onClick={() => selectTeam(t.id)}
                        aria-pressed={isSelected}
                      >
                        <span
                          className="org-team__dot"
                          style={{ background: c.dot }}
                        />
                        <span className="org-team__name">{t.name}</span>
                        <span className="org-team__count">
                          {countByTeamId.get(t.id) ?? 0}
                        </span>
                      </button>
                      <div className="org-team__actions">
                        <button
                          type="button"
                          className="org-team__action"
                          onClick={() => startRename(t)}
                          aria-label={`Rename ${t.name}`}
                          title="Rename"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="org-team__action org-team__action--danger"
                          onClick={() => deleteTeam(t)}
                          aria-label={`Delete ${t.name}`}
                          title="Delete"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
            {teams.length === 0 && (
              <li className="org-teams__empty">
                No teams yet. Create one above — like HR, Executives, or
                Accounting.
              </li>
            )}
          </ul>
        </section>

        {/* ── Right: the selected team's roster ── */}
        <section className="settings-section org-panel" ref={detailRef}>
          {selectedTeam ? (
            <>
              <header className="org-detail__head">
                <span
                  className="org-detail__dot"
                  style={{ background: colorForTeam(selectedTeam.id).dot }}
                  aria-hidden="true"
                />
                <h2 className="org-detail__name">{selectedTeam.name}</h2>
                <span className="org-detail__count">
                  {teamMembers.length}{' '}
                  {teamMembers.length === 1 ? 'member' : 'members'}
                </span>
              </header>

              {/* Courses this team is required to complete. */}
              <div className="org-detail__subhead">Required courses</div>
              <ul
                className="org-courses"
                role="group"
                aria-label={`Courses required for ${selectedTeam.name}`}
              >
                {COURSE_OPTIONS.map((c) => {
                  const key = courseKey(selectedTeam.id, c.slug)
                  const assigned = courseEdges.has(key)
                  const busy = busyCourses.has(key)
                  return (
                    <li key={c.slug} className="org-course">
                      <label className="org-course__label">
                        <input
                          type="checkbox"
                          className="org-course__check"
                          checked={assigned}
                          disabled={busy}
                          onChange={() =>
                            toggleCourse(selectedTeam.id, c.slug, assigned)
                          }
                        />
                        <span>{c.title}</span>
                      </label>
                      {busy && (
                        <span className="org-course__busy" aria-live="polite">
                          Saving…
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>

              <div className="org-search">
                <svg className="org-search__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="17" height="17" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={searchInputRef}
                  className="org-search__input"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  placeholder={`Add someone to ${selectedTeam.name}…`}
                  aria-label={`Search people to add to ${selectedTeam.name}`}
                />
              </div>

              {availableMembers.length > 0 ? (
                <>
                  <p className="org-search__count" aria-live="polite">
                    {addQuery
                      ? `${filteredAdd.length} ${filteredAdd.length === 1 ? 'match' : 'matches'}`
                      : `${availableMembers.length} ${availableMembers.length === 1 ? 'person' : 'people'} you can add`}
                  </p>
                  <ul className="org-results">
                    {shownAdd.map((m) => {
                      const key = edgeKey(selectedTeam.id, m.userId)
                      return (
                        <li key={m.userId} className="org-row">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.avatarUrl || '/default_avatar.png'}
                            alt=""
                            className="org-row__avatar"
                          />
                          <span className="org-row__name">
                            <span className="org-row__nametext">
                              {m.fullName ?? 'Unnamed member'}
                            </span>
                          </span>
                          <span className={`org-row__role org-row__role--${m.role}`}>
                            {m.role === 'manager' ? 'Manager' : 'Member'}
                          </span>
                          <button
                            type="button"
                            className="org-row__add"
                            disabled={busyEdges.has(key)}
                            onClick={() => addToTeam(selectedTeam.id, m.userId)}
                            aria-label={`Add ${m.fullName ?? 'member'} to ${selectedTeam.name}`}
                          >
                            + Add
                          </button>
                        </li>
                      )
                    })}
                    {addQuery && filteredAdd.length === 0 && (
                      <li className="org-results__empty">
                        No one matching “{addSearch.trim()}” to add.
                      </li>
                    )}
                    {filteredAdd.length > MAX_RESULTS && (
                      <li className="org-results__more">
                        Showing {MAX_RESULTS} of {filteredAdd.length} — keep
                        typing to narrow it down.
                      </li>
                    )}
                  </ul>
                </>
              ) : (
                <p className="org-search__hint">
                  Everyone in your organization is already in {selectedTeam.name}.
                </p>
              )}

              <div className="org-detail__subhead">In this team</div>
              <ul className="org-rows">
                {teamMembers.map((m) => {
                  const key = edgeKey(selectedTeam.id, m.userId)
                  const isYou = m.userId === currentUserId
                  return (
                    <li key={m.userId} className="org-row">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.avatarUrl || '/default_avatar.png'}
                        alt=""
                        className="org-row__avatar"
                      />
                      <span className="org-row__name">
                        <span className="org-row__nametext">
                          {m.fullName ?? 'Unnamed member'}
                        </span>
                        {isYou && <span className="org-row__you">You</span>}
                      </span>
                      <span className={`org-row__role org-row__role--${m.role}`}>
                        {m.role === 'manager' ? 'Manager' : 'Member'}
                      </span>
                      <button
                        type="button"
                        className="org-row__remove"
                        disabled={busyEdges.has(key)}
                        onClick={() => removeFromTeam(selectedTeam.id, m.userId)}
                        aria-label={`Remove ${m.fullName ?? 'member'} from ${selectedTeam.name}`}
                        title="Remove from team"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="15" height="15" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </li>
                  )
                })}
                {teamMembers.length === 0 && (
                  <li className="org-rows__empty">
                    No one’s in {selectedTeam.name} yet. Search above to add
                    people.
                  </li>
                )}
              </ul>
            </>
          ) : (
            <div className="org-detail__empty">
              <p>Create a team on the left to get started.</p>
              <p className="org-detail__empty-sub">
                Teams are groups inside your organization — like HR,
                Executives, or Accounting — and you can put people on more
                than one.
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
