import Link from 'next/link'
import { courseThemeVars, type Course } from '@/lib/courses'

/**
 * "Your program": one compact row per program course — name, progress
 * bar, and a link — instead of tall description cards.
 */
export function ProgramList({
  rows,
}: {
  rows: { course: Course; done: number; total: number }[]
}) {
  if (rows.length === 0) return null
  return (
    <section className="dash-card program" aria-labelledby="program-h">
      <div className="dash-card__head">
        <h2 id="program-h" className="dash-card__title">
          Your program
        </h2>
        <Link href="/courses" className="dash-card__link dash-card__link--inline">
          All courses
        </Link>
      </div>
      <ul className="program__list">
        {rows.map(({ course, done, total }) => {
          const pct = total > 0 ? Math.round((done / total) * 100) : 0
          const label =
            total === 0 ? 'Coming soon' : done >= total ? 'Complete' : `${done} of ${total} done`
          return (
            <li key={course.slug} className="program__row" style={courseThemeVars(course.theme)}>
              <div className="program__name">
                <Link href={`/courses/${course.slug}`}>{course.title}</Link>
                <span>{label}</span>
              </div>
              <div
                className="program__track"
                role="progressbar"
                aria-label={`${course.title} progress`}
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                {pct > 0 && <span style={{ width: `${pct}%` }} />}
              </div>
              <span className="program__pct">{total > 0 ? `${pct}%` : '—'}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
