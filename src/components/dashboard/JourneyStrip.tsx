import Link from 'next/link'
import { courseThemeVars, type Course } from '@/lib/courses'
import { partOrdinal } from '@/lib/machine-queries'
import type { MachineJourney } from '@/lib/dashboard-queries'

/**
 * The 5D Machine, Part by Part: one column per Part with a segment per
 * lesson, so the member sees the whole climb and exactly where they are.
 */
export function JourneyStrip({ journey, course }: { journey: MachineJourney; course: Course }) {
  const { parts, totalLessons, doneLessons, currentPart } = journey
  return (
    <section className="dash-card journey" aria-labelledby="journey-h" style={courseThemeVars(course.theme)}>
      <div className="dash-card__head">
        <h2 id="journey-h" className="dash-card__title">
          {course.title}
        </h2>
        <span className="dash-card__aside">
          <strong>
            {doneLessons} of {totalLessons}
          </strong>{' '}
          lessons
        </span>
      </div>
      <ol className="journey__parts">
        {parts.map((p) => {
          const state =
            p.done === p.lessons.length ? 'done' : p.number === currentPart ? 'current' : 'upcoming'
          return (
            <li key={p.number} className={`journey__part journey__part--${state}`}>
              <p className="journey__label">
                Part {partOrdinal(p.number)}
                {state === 'current' && <span className="journey__here">You are here</span>}
                {state === 'done' && <span className="journey__done">Done</span>}
              </p>
              <p className="journey__title">{p.title}</p>
              <div
                className="journey__segments"
                role="img"
                aria-label={`${p.done} of ${p.lessons.length} lessons done`}
              >
                {p.lessons.map((l) => (
                  <span key={l.id} className={l.done ? 'is-done' : undefined} />
                ))}
              </div>
            </li>
          )
        })}
      </ol>
      <Link href={`/courses/${course.slug}`} className="dash-card__link">
        See every lesson
      </Link>
    </section>
  )
}
