import type { StreakData } from '@/lib/content-queries'

/**
 * Dashboard streak banner — the habit focal point. A warm, flame-forward
 * card with the current day-streak as a big number and this week's
 * activity as an illustrated Mon–Sun strip. The flame has a subtle
 * flicker (suppressed under prefers-reduced-motion).
 */
export function StreakBanner({ data }: { data: StreakData }) {
  const { streak, activeToday, weekDays } = data

  const nudge =
    streak === 0
      ? 'Finish one thing today to begin.'
      : activeToday
        ? `You're on a roll — ${streak} day${streak === 1 ? '' : 's'} and counting.`
        : 'Don’t break it — finish one thing today to keep it.'

  return (
    <section className="streak" aria-label={`Current streak: ${streak} day${streak === 1 ? '' : 's'}`}>
      <span className="streak__flame" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="34" height="34">
          <path
            fill="currentColor"
            d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
          />
        </svg>
      </span>

      <div className="streak__count">
        {streak === 0 ? (
          <span className="streak__start">Start your streak</span>
        ) : (
          <p className="streak__countline">
            <span className="streak__num">{streak}</span>
            <span className="streak__unit">day{streak === 1 ? '' : 's'} streak</span>
          </p>
        )}
        <p className="streak__nudge">{nudge}</p>
      </div>

      <div className="streak__week" aria-hidden="true">
        {weekDays.map((d, i) => (
          <div key={i} className="streak__day">
            <span className="streak__daylabel">{d.label}</span>
            <span className={`streak__dot streak__dot--${d.state}`}>
              {d.state === 'done' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
