import type { OrgMember } from '@/lib/org-queries'

/**
 * Member roster for the Team page.
 *
 * Renders one row per OrgMember with avatar, name, role badge, and
 * joined date. The current user's row is highlighted with a "You" tag
 * so the manager can locate themselves at a glance.
 *
 * Read-only. Member actions (remove, promote) are a separate feature
 * coming after this page.
 */
export function TeamRoster({
  members,
  currentUserId,
}: {
  members: OrgMember[]
  currentUserId: string
}) {
  return (
    <section className="settings-section team-roster">
      <header className="settings-section__header">
        <h2>Members</h2>
        <p>
          {members.length} member{members.length === 1 ? '' : 's'} in your
          organization.
        </p>
      </header>

      <ul className="team-roster__list">
        {members.map((m) => {
          const isYou = m.userId === currentUserId
          const displayName = m.fullName ?? '—'
          const joinedLabel = formatJoinedDate(m.joinedAt)

          return (
            <li key={m.userId} className="team-roster__row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.avatarUrl || '/default_avatar.png'}
                alt=""
                className="team-roster__avatar"
              />
              <div className="team-roster__info">
                <div className="team-roster__name-line">
                  <span className="team-roster__name">{displayName}</span>
                  {isYou && <span className="team-roster__you">You</span>}
                </div>
                <span className="team-roster__joined">
                  Joined {joinedLabel}
                </span>
              </div>
              <span
                className={`team-roster__role team-roster__role--${m.role}`}
              >
                {m.role === 'manager' ? 'Manager' : 'Member'}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function formatJoinedDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
