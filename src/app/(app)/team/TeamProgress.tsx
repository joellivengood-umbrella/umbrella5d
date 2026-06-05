import type { OrgMember, TeamProgressRow } from '@/lib/org-queries'

/**
 * "Team Progress" section on the manager's /team page.
 *
 * One row per member showing a horizontal progress bar plus a
 * percentage and (completed / total) count. Members are listed in the
 * same order as the roster, so the manager can scan top-to-bottom and
 * spot stragglers.
 *
 * Denominator is the Umbrella Program total (BSS + EOS + Machine),
 * matching what each member sees in their own sidebar. Bonus Daily Pod
 * episodes are not counted toward program progress.
 *
 * Read-only.
 */
export function TeamProgress({
  members,
  progress,
  accessibleTotal,
  currentUserId,
}: {
  members: OrgMember[]
  progress: TeamProgressRow[]
  accessibleTotal: number
  currentUserId: string
}) {
  // Index progress by user_id for O(1) lookup.
  const completedByUser = new Map<string, number>()
  for (const row of progress) {
    completedByUser.set(row.userId, row.completed)
  }

  return (
    <section className="settings-section team-progress">
      <header className="settings-section__header">
        <h2>Team progress</h2>
        <p>
          How each team member is doing across the Umbrella Program.
          Bonus Daily Pod episodes aren&rsquo;t counted toward program
          totals.
        </p>
      </header>

      <ul className="team-progress__list">
        {members.map((m) => {
          const isYou = m.userId === currentUserId
          const completed = Math.min(
            completedByUser.get(m.userId) ?? 0,
            accessibleTotal
          )
          const pct =
            accessibleTotal > 0
              ? Math.round((completed / accessibleTotal) * 100)
              : 0

          return (
            <li key={m.userId} className="team-progress__row">
              <div className="team-progress__label">
                <span className="team-progress__name">
                  {m.fullName ?? '—'}
                </span>
                {isYou && <span className="team-roster__you">You</span>}
              </div>
              <div className="team-progress__bar-wrap">
                <div
                  className="team-progress__track"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${m.fullName ?? 'Member'} progress: ${pct} percent`}
                >
                  <div
                    className="team-progress__fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="team-progress__count">
                  {pct}% <span className="team-progress__count-detail">({completed} / {accessibleTotal})</span>
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
