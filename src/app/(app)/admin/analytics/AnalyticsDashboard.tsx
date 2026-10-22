import Link from 'next/link'
import { BodyClass } from '@/components/app/BodyClass'
import { MBA_VERSIONS } from '@/lib/courses'
import type {
  AnalyticsBreakdown,
  AnalyticsDashboard as DashboardData,
  AnalyticsOverview,
  AnalyticsRange,
  AnalyticsRetention,
  AnalyticsSection,
  PartnerFilter,
  PartnerOption,
} from '@/lib/admin-analytics'
import { ANALYTICS_RANGES, BREAKDOWN_HEADING_ID } from '@/lib/admin-analytics'
import { AnalyticsFilterLink, AnalyticsShell } from './AnalyticsShell'
import { ActiveMembersChart } from './ActiveMembersChart'
import { RetentionGrid } from './RetentionGrid'
import {
  addDays,
  formatCount,
  formatDay,
  formatDecimal,
  formatInstant,
  formatPercent,
  formatZone,
  instantToDay,
  percentDelta,
  pointDelta,
  type Delta,
} from './format'

/** Tracked events, in the order the activity table lists them. */
const EVENTS: { event: string; label: string; hint: string }[] = [
  { event: 'login', label: 'Logins', hint: 'Signed in' },
  { event: 'course_opened', label: 'Course opens', hint: 'Opened a course page' },
  { event: 'content_completed', label: 'Marked complete', hint: 'Clicked Mark Complete on a lesson or episode, including repeats' },
  { event: 'content_uncompleted', label: 'Completions undone', hint: 'Un-marked a lesson' },
  { event: 'potd_played', label: 'Daily Pod plays', hint: 'Started an episode' },
  { event: 'potd_completed', label: 'Daily Pod finishes', hint: 'Played an episode to the end' },
  { event: 'machine_block_checked', label: '5D Machine steps checked', hint: 'Ticked off a step' },
  { event: 'machine_block_unchecked', label: '5D Machine steps unchecked', hint: 'Un-ticked a step' },
  { event: 'machine_activity_saved', label: '5D Machine answers saved', hint: 'Saved an activity answer' },
]

/**
 * The /admin/analytics view. Pure presentation — page.tsx validates the URL
 * and loads the data; this renders whatever slice it was handed.
 * `partners` is null when the partner list failed to load.
 */
export function AnalyticsDashboard({
  range,
  partner,
  partners,
  data,
}: {
  range: AnalyticsRange
  partner: PartnerFilter
  partners: PartnerOption[] | null
  data: DashboardData
}) {
  const { overview, breakdown, retention } = data
  const partnerId = partner && partner !== 'none' ? partner : null
  const selectedPartner = partnerId ? partners?.find((p) => p.id === partnerId) ?? null : null
  // Is the id a real partner? The list says so when it loaded; otherwise
  // ask the partner-scoped breakdown, which names the partner it found.
  const unknownPartner = Boolean(
    partnerId &&
      !selectedPartner &&
      (partners !== null || (breakdown?.level === 'organization' && breakdown.partnerName === null))
  )
  const partnerName = selectedPartner?.name ?? (partnerId ? breakdown?.partnerName ?? null : null)
  const tz = overview?.range.tz || retention?.tz || 'America/Chicago'

  const scopeLabel = partnerId
    ? `${partnerName ?? 'Partner'} members`
    : partner === 'none'
      ? 'Members without a partner'
      : 'All members'
  // What "new" means differs by scope (the RPC uses the matching date).
  const newMembersMeaning = partnerId
    ? partnerName
      ? `joined a ${partnerName} organization`
      : "joined one of this partner's organizations"
    : 'new sign-ups'
  // Keep the filter showing the partner in view even if the list failed.
  const filterOptions =
    partnerId && !unknownPartner && !partners?.some((p) => p.id === partnerId)
      ? [...(partners ?? []), { id: partnerId, name: partnerName ?? 'Selected partner' }]
      : partners ?? []

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="analytics-main">
        <div className="courses-header">
          <Link href="/admin" className="lesson-back-btn">
            ← Admin
          </Link>
          <p className="section-eyebrow">Admin</p>
          <h1>Analytics</h1>
          <p className="courses-header__blurb">
            How members are engaging with Umbrella, from our own first-party
            data. Staff accounts are excluded, and days are counted in{' '}
            {formatZone(tz)}.
          </p>
        </div>

        <AnalyticsShell
          range={range}
          partner={unknownPartner ? '' : partner}
          partners={filterOptions}
        >
          <FailureNotice
            data={data}
            range={range}
            partnersFailed={partners === null}
            sectionsHidden={unknownPartner}
          />

          {unknownPartner ? (
            <div className="analytics-notice">
              That partner doesn&apos;t exist (it may have been deleted).{' '}
              <AnalyticsFilterLink partner="" focusId={KPIS_HEADING_ID} className="analytics-link">
                Show all partners
              </AnalyticsFilterLink>
            </div>
          ) : (
            <>
              {overview && (
                <OverviewSections
                  overview={overview}
                  range={range}
                  tz={tz}
                  scopeLabel={scopeLabel}
                  newMembersMeaning={newMembersMeaning}
                />
              )}
              {breakdown && (
                <BreakdownSection
                  breakdown={breakdown}
                  unpartnered={partner === 'none'}
                  range={range}
                />
              )}
              {retention && (
                <RetentionSection
                  retention={retention}
                  trackingStarted={overview?.trackingStarted ?? null}
                  tz={tz}
                />
              )}
              {overview && <TopContentSection overview={overview} range={range} />}
            </>
          )}
        </AnalyticsShell>
      </main>
    </>
  )
}

// ── Load failures ───────────────────────────────────────────────────

const ANALYTICS_SHORTEST = Math.min(...ANALYTICS_RANGES)

/** The KPI heading — "Show all partners" on the unknown-partner notice lands focus here. */
const KPIS_HEADING_ID = 'analytics-kpis-h'

const SECTION_NAMES: Record<AnalyticsSection, string> = {
  overview: 'the activity overview',
  breakdown: 'the breakdown table',
  retention: 'weekly retention',
}

/** "a", "a and b", "a, b and c" — capitalized, as the start of a sentence. */
function listSentence(items: string[], verb: string): string {
  if (items.length === 0) return ''
  const list =
    items.length === 1
      ? items[0]
      : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} ${verb}.`
}

/**
 * Says exactly what didn't load and what will help: a shorter range only
 * when a range-bound section timed out and a shorter range exists (weekly
 * retention ignores the range), and "shown below" only when something was.
 * With sectionsHidden (an unknown partner hides every section) only the
 * failures that still matter are reported.
 */
function FailureNotice({
  data,
  range,
  partnersFailed,
  sectionsHidden,
}: {
  data: DashboardData
  range: AnalyticsRange
  partnersFailed: boolean
  sectionsHidden: boolean
}) {
  const { failures } = data
  const sections = Object.keys(SECTION_NAMES) as AnalyticsSection[]

  if (sections.some((s) => failures[s] === 'missing')) {
    return (
      <div className="analytics-notice analytics-notice--error" role="alert">
        <strong>The analytics database functions aren&apos;t installed
        yet.</strong> Run the{' '}
        <code>20261021_admin_analytics_dashboard.sql</code> migration in
        Supabase, then refresh.
      </div>
    )
  }

  const failed = sectionsHidden ? [] : sections.filter((s) => failures[s])
  if (failed.length === 0 && !partnersFailed) return null
  const slow = failed.filter((s) => failures[s] === 'timeout').map((s) => SECTION_NAMES[s])
  const broken = [
    ...failed.filter((s) => failures[s] === 'other').map((s) => SECTION_NAMES[s]),
    ...(partnersFailed ? ['the partner list'] : []),
  ]
  const tryShorter =
    range > ANALYTICS_SHORTEST &&
    failed.some((s) => s !== 'retention' && failures[s] === 'timeout')
  const someLoaded = failed.length > 0 && failed.length < sections.length

  return (
    <div className="analytics-notice analytics-notice--error" role="alert">
      <strong>
        {[listSentence(slow, 'took too long to compute'), listSentence(broken, "couldn't load")]
          .filter(Boolean)
          .join(' ')}
      </strong>{' '}
      {tryShorter ? 'Try a shorter range, or refresh in a minute.' : 'Refresh in a minute to try again.'}
      {someLoaded && ' The sections that loaded are shown below.'}
    </div>
  )
}

// ── Overview: tracking note, KPI tiles, daily chart, courses, activity ──

/** Stickiness is avg daily ÷ active-in-range, so name the ratio it really is. */
const STICKINESS_NAME: Record<AnalyticsRange, string> = {
  7: 'DAU/WAU',
  30: 'DAU/MAU',
  90: 'DAU/90-day',
}

function OverviewSections({
  overview,
  range,
  tz,
  scopeLabel,
  newMembersMeaning,
}: {
  overview: AnalyticsOverview
  range: AnalyticsRange
  tz: string
  scopeLabel: string
  newMembersMeaning: string
}) {
  const k = overview.kpis
  const trackingDay = overview.trackingStarted
    ? instantToDay(overview.trackingStarted, tz)
    : null
  const prevStart = addDays(overview.range.start, -range)
  // Event-based comparisons need events for the whole previous period.
  const eventHistoryShort = !trackingDay || trackingDay > prevStart
  const compareNote = trackingDay
    ? `Comparison starts once tracking covers the prior ${range} days`
    : 'No tracked activity yet'

  const stickiness = k.activeUsers > 0 ? k.avgDailyActive / k.activeUsers : 0
  const stickinessPrev = k.activeUsersPrev > 0 ? k.avgDailyActivePrev / k.activeUsersPrev : 0
  // Stickiness is a ratio of active members: with nobody active in a period
  // it's undefined (0/0), so fall back to the same wording the other tiles use.
  const stickinessDelta: Delta =
    k.activeUsersPrev === 0
      ? percentDelta(k.activeUsers, 0)
      : k.activeUsers === 0
        ? { direction: 'none', text: 'No active members this period' }
        : pointDelta(stickiness, stickinessPrev)
  // The average only counts days tracking covered (it began mid-range).
  const avgHint =
    trackingDay && trackingDay > overview.range.end && k.activeUsers === 0
      ? 'members on a typical day (no full day tracked yet)'
      : k.avgDailyDays > 0 && k.avgDailyDays < range
        ? `members on a typical day (over ${k.avgDailyDays} tracked day${k.avgDailyDays === 1 ? '' : 's'})`
        : 'members on a typical day'

  const courses = overview.courses
  const maxLearners = Math.max(0, ...courses.map((c) => c.learners))
  const activity = EVENTS.map((e) => {
    const found = overview.activity.find((a) => a.event === e.event)
    return { ...e, events: found?.events ?? 0, users: found?.users ?? 0 }
  })
  const maxEvents = Math.max(0, ...activity.map((a) => a.events))

  return (
    <>
      {!overview.trackingStarted ? (
        <div className="analytics-notice">
          <strong>No activity has been recorded yet.</strong> Events start
          flowing as members sign in, open courses and complete lessons.
        </div>
      ) : (
        trackingDay &&
        trackingDay > overview.range.start && (
          <div className="analytics-notice">
            Tracking began on {formatInstant(overview.trackingStarted, tz)}, so
            active-member numbers start then. Completions come from saved
            progress and cover the whole period.
          </div>
        )
      )}

      <section className="analytics-section" aria-labelledby={KPIS_HEADING_ID}>
        <div className="analytics-section__head">
          {/* tabIndex -1: "Show all partners" lands focus here after it navigates */}
          <h2 id={KPIS_HEADING_ID} tabIndex={-1} className="analytics-focus-target">
            {scopeLabel}
          </h2>
          <p>
            Last {range} full days · {formatDay(overview.range.start)} –{' '}
            {formatDay(overview.range.end)} · today is on the chart
          </p>
        </div>
        <div className="analytics-kpis">
          <StatTile
            label="Active members"
            value={formatCount(k.activeUsers)}
            delta={percentDelta(k.activeUsers, k.activeUsersPrev)}
            range={range}
            unavailable={eventHistoryShort ? compareNote : null}
            hint={`of ${formatCount(k.membersTotal)} members`}
          />
          <StatTile
            label="Avg. daily active"
            value={formatDecimal(k.avgDailyActive)}
            delta={percentDelta(k.avgDailyActive, k.avgDailyActivePrev)}
            range={range}
            unavailable={eventHistoryShort ? compareNote : null}
            hint={avgHint}
          />
          <StatTile
            label={`Stickiness (${STICKINESS_NAME[range]})`}
            value={formatPercent(stickiness)}
            delta={stickinessDelta}
            range={range}
            unavailable={eventHistoryShort ? compareNote : null}
            hint={`avg. daily active ÷ members active in these ${range} days`}
          />
          <StatTile
            label="Completions"
            value={formatCount(k.completions)}
            delta={percentDelta(k.completions, k.completionsPrev)}
            range={range}
            hint="lessons and episodes finished"
          />
          <StatTile
            label="New members"
            value={formatCount(k.newMembers)}
            delta={percentDelta(k.newMembers, k.newMembersPrev)}
            range={range}
            hint={`${newMembersMeaning} · ${formatCount(k.membersTotal)} in total`}
          />
        </div>
      </section>

      <section className="analytics-card" aria-labelledby="analytics-daily-h">
        <div className="analytics-card__head">
          <h2 id="analytics-daily-h">Daily active members</h2>
          <p>Members who signed in, opened a course or completed something each day.</p>
        </div>
        <ActiveMembersChart data={overview.daily} today={overview.today} />
      </section>

      <div className="analytics-pair">
        <section className="analytics-card" aria-labelledby="analytics-courses-h">
          <div className="analytics-card__head">
            <h2 id="analytics-courses-h">Engagement by course</h2>
            <p>
              Visits count each member once per day. Active learners did
              anything in the course during the period.
            </p>
          </div>
          <div className="analytics-scroll">
            <table className="admin-table analytics-table">
              <thead>
                <tr>
                  <th scope="col" className="analytics-namecol">Course</th>
                  <th scope="col" className="analytics-num">Visits</th>
                  <th scope="col" className="analytics-barcol">Active learners</th>
                  <th scope="col" className="analytics-num">Completions</th>
                </tr>
              </thead>
              <tbody>
                {courses.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="admin-empty">No courses yet.</div>
                    </td>
                  </tr>
                ) : (
                  courses.map((c) => (
                    <tr key={c.slug}>
                      <td>
                        <span className="analytics-name">{c.title}</span>
                        {!c.isPublished ? (
                          <span className="admin-pill admin-pill--draft">Draft</span>
                        ) : (
                          !c.inProgram && (
                            <span className="admin-pill admin-pill--muted">Bonus</span>
                          )
                        )}
                      </td>
                      <td className="analytics-num">{formatCount(c.visits)}</td>
                      <td className="analytics-barcol">
                        <BarCell value={c.learners} max={maxLearners} />
                      </td>
                      <td className="analytics-num">{formatCount(c.completions)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="analytics-card" aria-labelledby="analytics-activity-h">
          <div className="analytics-card__head">
            <h2 id="analytics-activity-h">Activity mix</h2>
            <p>
              Every tracked action in the period, repeats included, and how
              many members did it — so it won&apos;t match Completions above,
              which counts each member&apos;s finished items once.
            </p>
          </div>
          <div className="analytics-scroll">
            <table className="admin-table analytics-table">
              <thead>
                <tr>
                  <th scope="col" className="analytics-namecol">Action</th>
                  <th scope="col" className="analytics-barcol">Times</th>
                  <th scope="col" className="analytics-num">Members</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((a) => (
                  <tr key={a.event}>
                    <td>
                      <span className="analytics-name">{a.label}</span>
                      <span className="analytics-hint">{a.hint}</span>
                    </td>
                    <td className="analytics-barcol">
                      <BarCell value={a.events} max={maxEvents} />
                    </td>
                    <td className="analytics-num">{formatCount(a.users)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  )
}

function StatTile({
  label,
  value,
  delta,
  range,
  hint,
  unavailable = null,
}: {
  label: string
  value: string
  delta: Delta
  range: AnalyticsRange
  hint?: string
  unavailable?: string | null
}) {
  return (
    <div className="analytics-kpi">
      <span className="analytics-kpi__label">{label}</span>
      <span className="analytics-kpi__value">{value}</span>
      {unavailable ? (
        <span className="analytics-delta analytics-delta--muted">{unavailable}</span>
      ) : (
        <DeltaLine delta={delta} range={range} />
      )}
      {hint && <span className="analytics-kpi__hint">{hint}</span>}
    </div>
  )
}

/** Direction is carried by an arrow AND words, never by color alone. */
function DeltaLine({ delta, range }: { delta: Delta; range: AnalyticsRange }) {
  const vs = <span className="analytics-delta__vs">vs prior {range} days</span>
  if (delta.direction === 'up' || delta.direction === 'down') {
    const up = delta.direction === 'up'
    return (
      <span className={`analytics-delta analytics-delta--${up ? 'up' : 'down'}`}>
        <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
          <path d={up ? 'M5 1.5 9 8.5H1z' : 'M5 8.5 1 1.5h8z'} fill="currentColor" />
        </svg>
        <span className="analytics-sr">{up ? 'Up' : 'Down'} </span>
        {delta.text} {vs}
      </span>
    )
  }
  if (delta.direction === 'new') {
    return <span className="analytics-delta analytics-delta--new">{delta.text}</span>
  }
  if (delta.direction === 'flat') {
    return (
      <span className="analytics-delta analytics-delta--muted">
        {delta.text} {vs}
      </span>
    )
  }
  return <span className="analytics-delta analytics-delta--muted">{delta.text}</span>
}

/** A thin single-hue bar with its value at the tip (no color-only reading). */
function BarCell({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0
  return (
    <div className="analytics-bar">
      <span className="analytics-bar__track" aria-hidden="true">
        {pct > 0 && <span className="analytics-bar__fill" style={{ width: `${pct}%` }} />}
      </span>
      <span
        className="analytics-bar__value"
        style={{ left: pct > 0 ? `calc(${pct}% + 6px)` : 0 }}
      >
        {formatCount(value)}
      </span>
    </div>
  )
}

// ── Breakdown: partners, or one partner's organizations ─────────────

function BreakdownSection({
  breakdown,
  unpartnered,
  range,
}: {
  breakdown: AnalyticsBreakdown
  unpartnered: boolean
  range: AnalyticsRange
}) {
  const atPartnerLevel = breakdown.level === 'partner'
  const title = atPartnerLevel
    ? 'Partners'
    : unpartnered
      ? 'Organizations without a partner'
      : `Organizations · ${breakdown.partnerName ?? 'Partner'}`
  const activeMeans = `Active = did anything in the last ${range} full days.`
  const blurb = atPartnerLevel
    ? `Engagement by partner — select one to see its organizations. ${activeMeans} A member in organizations under two partners counts under both.`
    : `Engagement by organization for the selected members. ${activeMeans}`
  const rem = breakdown.remainder
  const cols = atPartnerLevel ? 6 : 5

  return (
    <section className="analytics-card" aria-labelledby={BREAKDOWN_HEADING_ID}>
      <div className="analytics-card__head analytics-card__head--split">
        <div>
          {/* tabIndex -1: a breakdown link lands focus here after it navigates */}
          <h2 id={BREAKDOWN_HEADING_ID} tabIndex={-1} className="analytics-focus-target">
            {title}
          </h2>
          <p>{blurb}</p>
        </div>
        {!atPartnerLevel && (
          <AnalyticsFilterLink partner="" className="btn btn--secondary btn--sm">
            ← All partners
          </AnalyticsFilterLink>
        )}
      </div>
      <div className="analytics-scroll">
        <table className="admin-table analytics-table">
          <thead>
            <tr>
              <th scope="col" className="analytics-namecol">{atPartnerLevel ? 'Partner' : 'Organization'}</th>
              {atPartnerLevel && <th scope="col" className="analytics-num">Orgs</th>}
              <th scope="col" className="analytics-num">Members</th>
              <th scope="col" className="analytics-num">Active</th>
              <th scope="col" className="analytics-num">% active</th>
              <th scope="col" className="analytics-num">Completions</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.rows.length === 0 && !rem ? (
              <tr>
                <td colSpan={cols}>
                  <div className="admin-empty">
                    {atPartnerLevel ? 'No partners yet.' : 'No organizations here yet.'}
                  </div>
                </td>
              </tr>
            ) : (
              breakdown.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {atPartnerLevel ? (
                      <AnalyticsFilterLink
                        partner={row.id}
                        partnerName={row.name}
                        className="analytics-link"
                      >
                        {row.name}
                      </AnalyticsFilterLink>
                    ) : (
                      <span className="analytics-name">{row.name}</span>
                    )}
                  </td>
                  {atPartnerLevel && (
                    <td className="analytics-num">{formatCount(row.orgs ?? 0)}</td>
                  )}
                  <td className="analytics-num">{formatCount(row.members)}</td>
                  <td className="analytics-num">{formatCount(row.active)}</td>
                  <td className="analytics-num">
                    {row.members > 0 ? formatPercent(row.active / row.members) : '—'}
                  </td>
                  <td className="analytics-num">{formatCount(row.completions)}</td>
                </tr>
              ))
            )}
            {rem && (
              <tr className="analytics-row--remainder">
                <td>
                  {rem.kind === 'unpartnered' ? (
                    <AnalyticsFilterLink partner="none" className="analytics-link">
                      No partner
                    </AnalyticsFilterLink>
                  ) : (
                    <span className="analytics-name">Individuals (no organization)</span>
                  )}
                </td>
                {atPartnerLevel && (
                  <td className="analytics-num">{formatCount(rem.orgs ?? 0)}</td>
                )}
                <td className="analytics-num">{formatCount(rem.members)}</td>
                <td className="analytics-num">{formatCount(rem.active)}</td>
                <td className="analytics-num">
                  {rem.members > 0 ? formatPercent(rem.active / rem.members) : '—'}
                </td>
                <td className="analytics-num">{formatCount(rem.completions)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {breakdown.totalRows > breakdown.rows.length && (
        <p className="analytics-footnote">
          Showing the {breakdown.rows.length} most active of{' '}
          {formatCount(breakdown.totalRows)}.
        </p>
      )}
    </section>
  )
}

// ── Retention ───────────────────────────────────────────────────────

function RetentionSection({
  retention,
  trackingStarted,
  tz,
}: {
  retention: AnalyticsRetention
  trackingStarted: string | null
  tz: string
}) {
  const trackingDay = trackingStarted ? instantToDay(trackingStarted, tz) : null
  const windowStart = retention.thisWeek ? addDays(retention.thisWeek, -49) : ''
  const trackingIsRecent = Boolean(trackingDay && windowStart && trackingDay >= windowStart)

  return (
    <section className="analytics-card" aria-labelledby="analytics-retention-h">
      <div className="analytics-card__head">
        <h2 id="analytics-retention-h">Weekly retention</h2>
        <p>
          Of the members first active in a given week, the share active again
          in each week after. Always the last 8 weeks (the date range
          doesn&apos;t apply); the partner filter does.
        </p>
      </div>
      {trackingIsRecent && trackingStarted && (
        <p className="analytics-footnote analytics-footnote--top">
          Tracking began on {formatInstant(trackingStarted, tz)}. Cohorts go by
          first <em>tracked</em> week, so early cohorts include existing
          members seen for the first time since then.
        </p>
      )}
      <RetentionGrid cohorts={retention.cohorts} />
    </section>
  )
}

// ── Top content ─────────────────────────────────────────────────────

function TopContentSection({
  overview,
  range,
}: {
  overview: AnalyticsOverview
  range: AnalyticsRange
}) {
  const items = overview.topContent
  return (
    <section className="analytics-card" aria-labelledby="analytics-top-h">
      <div className="analytics-card__head">
        <h2 id="analytics-top-h">Most completed</h2>
        <p>The lessons and episodes finished most in the last {range} days.</p>
      </div>
      <div className="analytics-scroll">
        <table className="admin-table analytics-table">
          <thead>
            <tr>
              <th scope="col" className="analytics-num" style={{ width: 48 }}>#</th>
              <th scope="col" className="analytics-namecol">Lesson</th>
              <th scope="col">Course</th>
              <th scope="col" className="analytics-num">Completions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="admin-empty">No completions in this period.</div>
                </td>
              </tr>
            ) : (
              items.map((t, i) => {
                const version = MBA_VERSIONS.find((v) => v.slug === t.version)
                const course = t.courseTitle ?? t.courseSlug
                return (
                  <tr key={t.id}>
                    <td className="analytics-num">{i + 1}</td>
                    <td>
                      <span className="analytics-name">
                        {t.title ?? `${course} ${t.sequenceNum ?? ''}`.trim()}
                      </span>
                    </td>
                    <td>
                      {course}
                      {version && (
                        <span className="analytics-hint">{version.label}</span>
                      )}
                    </td>
                    <td className="analytics-num">{formatCount(t.completions)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
