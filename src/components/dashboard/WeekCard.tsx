import type { StreakData } from '@/lib/content-queries'

/**
 * "This week" card: the Mon–Sun activity strip and a one-line nudge. The
 * streak count itself lives in the dashboard header; this is the
 * small, winnable daily goal.
 */
export function WeekCard({ data }: { data: StreakData }) {
  const { streak, activeToday, weekDays } = data
  const activeDays = weekDays.filter((d) => d.state === 'done').length
  const nudge =
    streak === 0
      ? 'Finish one thing today to start a streak.'
      : activeToday
        ? `Nice — you’re on a ${streak}-day streak.`
        : 'Finish one thing today to keep your streak going.'

  return (
    <section className="dash-card dash-week" aria-labelledby="dash-week-h">
      <div className="dash-card__head">
        <h2 id="dash-week-h" className="dash-card__title">
          This week
        </h2>
        <span className="dash-card__aside">
          {activeDays} {activeDays === 1 ? 'day' : 'days'} active
        </span>
      </div>
      <ol className="dash-week__days" aria-label="Days active this week">
        {weekDays.map((d, i) => (
          <li key={i} className={`dash-week__day dash-week__day--${d.state}`}>
            <span className="dash-week__label">{d.label}</span>
            <span className="dash-week__dot">
              {d.state === 'done' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            <span className="dash-sr">
              {d.state === 'done' ? 'active' : d.state === 'today' ? 'today' : d.state === 'future' ? 'upcoming' : 'not active'}
            </span>
          </li>
        ))}
      </ol>
      <p className="dash-card__text">{nudge}</p>
    </section>
  )
}
