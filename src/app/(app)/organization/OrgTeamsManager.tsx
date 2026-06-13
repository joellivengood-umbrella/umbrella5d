'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { OrgMember, Team, TeamMembership } from '@/lib/org-queries'

/**
 * The interactive "My Organization" workspace.
 *
 * Left: the org member roster. Each row shows the person's avatar, name,
 * role badge, and the team chips they belong to — managers tag people
 * straight from the roster via the "+ Team" control, and remove a tag by
 * clicking the chip's ×.
 *
 * Right: the Teams panel — create a team, rename or delete it, and click
 * one to filter the roster down to its members.
 *
 * A person can be on several teams (many-to-many). All writes go
 * straight from the browser client and are authorized by the
 * teams / team_members RLS policies (manager-only, org-scoped); the UI
 * updates optimistically and rolls back on error.
 */

// A small fixed palette. Each team gets a stable color by its sorted
// position so chips stay visually distinguishable; wraps past 8 teams.
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

type Status = { type: 'success' | 'error'; msg: string } | null

export function OrgTeamsManager({
  orgId,
  currentUserId,
  members,
  initialTeams,
  initialMemberships,
}: {
  orgId: string
  currentUserId: string
  members: OrgMember[]
  initialTeams: Team[]
  initialMemberships: TeamMembership[]
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [teams, setTeams] = useState<Team[]>(initialTeams)
  // person<->team edges as a Set of "teamId::userId" for O(1) lookup.
  const [edges, setEdges] = useState<Set<string>>(
    () => new Set(initialMemberships.map((m) => edgeKey(m.teamId, m.userId)))
  )
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [busyEdges, setBusyEdges] = useState<Set<string>>(new Set())
  const [teamBusy, setTeamBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const [newTeamName, setNewTeamName] = useState('')
  const [openAddFor, setOpenAddFor] = useState<string | null>(null)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // Guards a rename so the input's onBlur (which fires when the field
  // unmounts after Enter/Escape) doesn't commit a second time — and so
  // Escape truly cancels instead of saving the edited value.
  const renameDoneRef = useRef(false)

  // Re-sync local state when the server sends fresh data (after
  // router.refresh, or a concurrent manager's change picked up on
  // navigation). Done during render — React's endorsed "adjust state on
  // prop change" pattern — and skipped while an optimistic edit is
  // mid-flight so it isn't clobbered. The awaited writes commit before
  // their refresh, so by the time new props arrive the DB reflects them.
  const [serverSnapshot, setServerSnapshot] = useState({
    teams: initialTeams,
    memberships: initialMemberships,
  })
  if (
    (serverSnapshot.teams !== initialTeams ||
      serverSnapshot.memberships !== initialMemberships) &&
    busyEdges.size === 0 &&
    !teamBusy &&
    !editingTeamId
  ) {
    setServerSnapshot({ teams: initialTeams, memberships: initialMemberships })
    setTeams(initialTeams)
    setEdges(new Set(initialMemberships.map((m) => edgeKey(m.teamId, m.userId))))
  }

  const sortByName = (a: Team, b: Team) => a.name.localeCompare(b.name)

  // Color by sorted position (teams state is kept name-sorted).
  const colorForTeam = (teamId: string) => {
    const idx = teams.findIndex((t) => t.id === teamId)
    return TEAM_COLORS[(idx < 0 ? 0 : idx) % TEAM_COLORS.length]
  }

  const teamsForUser = (userId: string) =>
    teams.filter((t) => edges.has(edgeKey(t.id, userId)))

  const countForTeam = (teamId: string) =>
    members.reduce(
      (n, m) => (edges.has(edgeKey(teamId, m.userId)) ? n + 1 : n),
      0
    )

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null
  const visibleMembers = selectedTeam
    ? members.filter((m) => edges.has(edgeKey(selectedTeam.id, m.userId)))
    : members

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
    setTeams((prev) => [...prev, created].sort(sortByName))
    setNewTeamName('')
    setStatus({ type: 'success', msg: `“${created.name}” team created.` })
    router.refresh()
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
    setTeams((ts) =>
      ts.map((t) => (t.id === team.id ? { ...t, name } : t)).sort(sortByName)
    )
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
    router.refresh()
  }

  // ── Delete a team ───────────────────────────────────────────────
  async function deleteTeam(team: Team) {
    if (
      !window.confirm(
        `Delete the “${team.name}” team? Its members stay in your organization but lose this team tag.`
      )
    ) {
      return
    }

    const prevTeams = teams
    const prevEdges = edges
    setTeams((ts) => ts.filter((t) => t.id !== team.id))
    setEdges((es) => {
      const n = new Set(es)
      for (const m of members) n.delete(edgeKey(team.id, m.userId))
      return n
    })
    if (selectedTeamId === team.id) setSelectedTeamId(null)

    // team_members rows cascade-delete in the DB via the team_id FK.
    const { error } = await supabase.from('teams').delete().eq('id', team.id)
    if (error) {
      setTeams(prevTeams) // rollback
      setEdges(prevEdges)
      console.error('deleteTeam error', error)
      setStatus({ type: 'error', msg: 'Could not delete the team.' })
      return
    }
    setStatus({ type: 'success', msg: `“${team.name}” team deleted.` })
    router.refresh()
  }

  // ── Tag / untag a member ↔ team ─────────────────────────────────
  async function addToTeam(teamId: string, userId: string) {
    const key = edgeKey(teamId, userId)
    if (edges.has(key) || busyEdges.has(key)) return
    // Leave the picker open so the manager can tag several teams in a row.
    setStatus(null)
    setBusyEdges((b) => new Set(b).add(key))
    setEdges((es) => new Set(es).add(key)) // optimistic

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
      {/* ── Members ── */}
      <section className="settings-section org-panel">
        <header className="settings-section__header org-panel__header">
          <div>
            <h2>Members</h2>
            <p aria-live="polite">
              {visibleMembers.length}{' '}
              {visibleMembers.length === 1 ? 'person' : 'people'}
              {selectedTeam ? ` in ${selectedTeam.name}` : ' in your organization'}.
            </p>
          </div>
          {selectedTeam && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setSelectedTeamId(null)}
            >
              Show all
            </button>
          )}
        </header>

        <ul className="org-roster">
          {visibleMembers.map((m) => {
            const myTeams = teamsForUser(m.userId)
            const available = teams.filter(
              (t) => !edges.has(edgeKey(t.id, m.userId))
            )
            const isYou = m.userId === currentUserId
            return (
              <li key={m.userId} className="org-member">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.avatarUrl || '/default_avatar.png'}
                  alt=""
                  className="org-member__avatar"
                />
                <div className="org-member__main">
                  <div className="org-member__name-line">
                    <span className="org-member__name">{m.fullName ?? '—'}</span>
                    {isYou && <span className="org-member__you">You</span>}
                  </div>
                  <div className="org-member__chips">
                    {myTeams.map((t) => {
                      const c = colorForTeam(t.id)
                      const key = edgeKey(t.id, m.userId)
                      return (
                        <span
                          key={t.id}
                          className="org-chip"
                          style={{ background: c.bg, color: c.text }}
                        >
                          <span
                            className="org-chip__dot"
                            style={{ background: c.dot }}
                          />
                          <span className="org-chip__label">{t.name}</span>
                          <button
                            type="button"
                            className="org-chip__x"
                            disabled={busyEdges.has(key)}
                            onClick={() => removeFromTeam(t.id, m.userId)}
                            aria-label={`Remove ${m.fullName ?? 'member'} from ${t.name}`}
                            title="Remove from team"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" width="11" height="11" aria-hidden="true">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </span>
                      )
                    })}

                    {/* Inline team picker. The toggle button is rendered
                        in BOTH states (same element) so focus survives
                        opening it; picks appear before it and tagging
                        keeps the picker open for rapid multi-add. */}
                    {teams.length > 0 &&
                      (openAddFor === m.userId || available.length > 0) && (
                        <span
                          className="org-add"
                          role="group"
                          aria-label={`Add ${m.fullName ?? 'member'} to a team`}
                        >
                          {openAddFor === m.userId &&
                            available.map((t) => {
                              const c = colorForTeam(t.id)
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  className="org-chip org-chip--pick"
                                  style={{ borderColor: c.dot, color: c.text }}
                                  onClick={() => addToTeam(t.id, m.userId)}
                                >
                                  <span
                                    className="org-chip__dot"
                                    style={{ background: c.dot }}
                                  />
                                  <span className="org-chip__label">{t.name}</span>
                                </button>
                              )
                            })}
                          <button
                            type="button"
                            className="org-chip org-chip--add"
                            aria-expanded={openAddFor === m.userId}
                            aria-label={
                              openAddFor === m.userId
                                ? 'Done adding to teams'
                                : `Add ${m.fullName ?? 'member'} to a team`
                            }
                            onClick={() =>
                              setOpenAddFor(openAddFor === m.userId ? null : m.userId)
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Escape' && openAddFor === m.userId) {
                                e.preventDefault()
                                setOpenAddFor(null)
                              }
                            }}
                          >
                            {openAddFor === m.userId ? (
                              available.length === 0 ? (
                                'On every team · Done'
                              ) : (
                                'Done'
                              )
                            ) : (
                              <>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="12" height="12" aria-hidden="true">
                                  <line x1="12" y1="5" x2="12" y2="19" />
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                Team
                              </>
                            )}
                          </button>
                        </span>
                      )}
                  </div>
                </div>
                <span className={`org-member__role org-member__role--${m.role}`}>
                  {m.role === 'manager' ? 'Manager' : 'Member'}
                </span>
              </li>
            )
          })}
          {visibleMembers.length === 0 && (
            <li className="org-roster__empty">
              No one is on this team yet. Use “+ Team” on a member to add them.
            </li>
          )}
        </ul>
      </section>

      {/* ── Teams ── */}
      <section className="settings-section org-panel">
        <header className="settings-section__header">
          <h2>Teams</h2>
          <p>
            {teams.length} {teams.length === 1 ? 'team' : 'teams'}
            {teams.length > 0 ? ' · click one to filter the roster' : ''}.
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
          {teams.map((t) => {
            const c = colorForTeam(t.id)
            const isSelected = selectedTeamId === t.id
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
                      onClick={() => setSelectedTeamId(isSelected ? null : t.id)}
                      aria-pressed={isSelected}
                    >
                      <span
                        className="org-team__dot"
                        style={{ background: c.dot }}
                      />
                      <span className="org-team__name">{t.name}</span>
                      <span className="org-team__count">{countForTeam(t.id)}</span>
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
              No teams yet. Create one above — like HR, Executives, or Accounting —
              then tag members into it from the roster.
            </li>
          )}
        </ul>
      </section>
      </div>
    </>
  )
}
