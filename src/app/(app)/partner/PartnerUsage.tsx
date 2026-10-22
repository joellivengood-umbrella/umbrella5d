import type { PartnerOrg } from '@/lib/org-queries'
import type { PartnerUsage } from '@/lib/partner-usage'

/**
 * Partner Dashboard usage sections: last-30-day tiles, 5D Machine progress,
 * and the per-organization table. Aggregates only — partners see how their
 * organizations use the program, never individual members.
 */

const QUIET_DAYS = 14
const DAY_MS = 86_400_000

const fmt = (n: number) => n.toLocaleString('en-US')

type Delta = { dir: 'up' | 'down' | 'flat' | 'new' | 'none'; text: string }

function delta(cur: number, prev: number): Delta {
  if (prev === 0 && cur === 0) return { dir: 'none', text: 'None either period' }
  if (prev === 0) return { dir: 'new', text: 'New this period' }
  const pct = Math.round((Math.abs(cur - prev) / prev) * 100)
  if (pct === 0) return { dir: 'flat', text: 'No change' }
  return { dir: cur > prev ? 'up' : 'down', text: `${pct}%` }
}

function DeltaLine({ d }: { d: Delta | null }) {
  if (!d) return <span className="pu-delta pu-delta--muted">Comparison starts after 60 days of tracking</span>
  if (d.dir === 'up' || d.dir === 'down') {
    return (
      <span className={`pu-delta pu-delta--${d.dir}`}>
        <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true">
          <path d={d.dir === 'up' ? 'M5 1.5 9 8.5H1z' : 'M5 8.5 1 1.5h8z'} fill="currentColor" />
        </svg>
        <span className="pu-sr">{d.dir === 'up' ? 'Up' : 'Down'} </span>
        {d.text} <span className="pu-delta__vs">vs prior 30 days</span>
      </span>
    )
  }
  return <span className="pu-delta pu-delta--muted">{d.text}</span>
}

/** The three last-30-day tiles. */
export function UsageTiles({ usage }: { usage: PartnerUsage }) {
  const k = usage.kpis
  // Active members come from tracked activity, so compare only once
  // tracking covers the whole previous 30 days.
  const prevStart = new Date(`${usage.window.start}T00:00:00Z`).getTime() - 30 * DAY_MS
  const activeComparable =
    usage.trackingStarted != null && new Date(usage.trackingStarted).getTime() <= prevStart
  const activePct = k.membersTotal > 0 ? Math.round((k.active / k.membersTotal) * 100) : 0

  return (
    <div className="partner-impact__grid">
      <div className="partner-impact__stat">
        <span className="partner-impact__num">{fmt(k.active)}</span>
        <span className="partner-impact__label">Active members</span>
        <span className="pu-sub">
          of {fmt(k.membersTotal)} · {activePct}%
        </span>
        <DeltaLine d={activeComparable ? delta(k.active, k.activePrev) : null} />
      </div>
      <div className="partner-impact__stat">
        <span className="partner-impact__num">{fmt(k.completions)}</span>
        <span className="partner-impact__label">Lessons completed</span>
        <DeltaLine d={delta(k.completions, k.completionsPrev)} />
      </div>
      <div className="partner-impact__stat">
        <span className="partner-impact__num">{fmt(k.newMembers)}</span>
        <span className="partner-impact__label">New members</span>
        <DeltaLine d={delta(k.newMembers, k.newMembersPrev)} />
      </div>
    </div>
  )
}

/** 5D Machine progress across the partner's members. */
export function MachineProgress({ usage }: { usage: PartnerUsage }) {
  const m = usage.machine
  if (m.lessons === 0 || m.members === 0) {
    return (
      <p className="pu-empty">
        {m.members === 0
          ? 'Progress will show here once members join your organizations.'
          : 'The 5D Machine lessons aren’t published yet.'}
      </p>
    )
  }
  const inProgress = m.parts.reduce((s, p) => s + p.members, 0)
  const maxPart = Math.max(1, ...m.parts.map((p) => p.members))
  return (
    <div className="pu-machine">
      <div className="pu-machine__avg">
        <div className="pu-machine__avgrow">
          <span className="pu-machine__avgnum">{Math.round(m.avgPct)}%</span>
          <span className="pu-machine__avglabel">average progress through the 5D Machine</span>
        </div>
        <div className="pu-bar" aria-hidden="true">
          <span className="pu-bar__fill" style={{ width: `${Math.min(100, m.avgPct)}%` }} />
        </div>
        <p className="pu-machine__facts">
          <span><strong>{fmt(m.finished)}</strong> finished</span>
          <span><strong>{fmt(inProgress)}</strong> in progress</span>
          <span><strong>{fmt(m.notStarted)}</strong> not started</span>
        </p>
      </div>
      {m.parts.length > 0 && (
        <div className="pu-parts">
          <p className="pu-parts__title">Where members are now</p>
          <ul>
            {m.parts.map((p) => (
              <li key={p.part} className="pu-parts__row">
                <span className="pu-parts__name">
                  Part {p.part}
                  {p.title ? <span className="pu-parts__sub"> · {p.title}</span> : null}
                </span>
                <span className="pu-parts__bar" aria-hidden="true">
                  {p.members > 0 && (
                    <span className="pu-bar__fill" style={{ width: `${(p.members / maxPart) * 100}%` }} />
                  )}
                </span>
                <span className="pu-parts__count">
                  {fmt(p.members)} {p.members === 1 ? 'member' : 'members'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function lastActiveText(iso: string | null, now: number): string {
  if (!iso) return 'No activity yet'
  const days = Math.floor((now - new Date(iso).getTime()) / DAY_MS)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Your organizations, with how each is using the program. */
export function OrgUsageTable({
  usage,
  orgs,
}: {
  usage: PartnerUsage
  orgs: PartnerOrg[]
}) {
  // eslint-disable-next-line react-hooks/purity -- server-rendered per request (force-dynamic)
  const now = Date.now()
  const joined = new Map(orgs.map((o) => [o.id, o.createdAt]))
  return (
    <div className="pu-scroll">
      <table className="pu-table">
        <thead>
          <tr>
            <th scope="col">Organization</th>
            <th scope="col" className="pu-num">Members</th>
            <th scope="col" className="pu-num">Active</th>
            <th scope="col" className="pu-num">% active</th>
            <th scope="col" className="pu-num">Lessons</th>
            <th scope="col">Last activity</th>
          </tr>
        </thead>
        <tbody>
          {usage.orgs.map((o) => {
            const quiet =
              o.members > 0 &&
              (!o.lastActive || now - new Date(o.lastActive).getTime() > QUIET_DAYS * DAY_MS)
            const since = joined.get(o.id)
            return (
              <tr key={o.id}>
                <td>
                  <span className="pu-org">{o.name}</span>
                  {quiet && (
                    <span className="pu-quiet" title={`No activity in ${QUIET_DAYS}+ days`}>
                      Quiet
                    </span>
                  )}
                  {since && (
                    <span className="pu-since">
                      Joined{' '}
                      {new Date(since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </td>
                <td className="pu-num">{fmt(o.members)}</td>
                <td className="pu-num">{fmt(o.active)}</td>
                <td className="pu-num">
                  {o.members > 0 ? `${Math.round((o.active / o.members) * 100)}%` : '—'}
                </td>
                <td className="pu-num">{fmt(o.completions)}</td>
                <td className="pu-last">{o.members > 0 ? lastActiveText(o.lastActive, now) : 'No members yet'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
