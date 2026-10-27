import Link from 'next/link'
import { courseThemeVars, type Course } from '@/lib/courses'

/**
 * The dashboard's lead card: the ONE next thing to do, with a single
 * obvious button. Shows where the member left off, or — for someone who
 * hasn't started — the first lesson of the program.
 */
export function UpNextCard({
  course,
  href,
  tileLabel,
  title,
  meta,
  starting,
  progress,
}: {
  course: Course
  href: string
  /** Big label on the colored tile, e.g. "1.3" or "12". */
  tileLabel: string
  title: string
  /** e.g. "The 5D Machine · Part One · Lesson 3" */
  meta: string
  /** True when the member hasn't started yet ("Start here"). */
  starting: boolean
  /** Course progress, e.g. { done: 3, total: 30 } — null to hide. */
  progress: { done: number; total: number } | null
}) {
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  return (
    <section className="upnext" aria-labelledby="upnext-title" style={courseThemeVars(course.theme)}>
      <div className="upnext__tile" aria-hidden="true">
        {tileLabel}
      </div>
      <div className="upnext__body">
        <p className="upnext__eyebrow">{starting ? 'Start here' : 'Up next'}</p>
        <h2 id="upnext-title" className="upnext__title">
          {title}
        </h2>
        <p className="upnext__meta">{meta}</p>
        {progress && progress.total > 0 && (
          <div className="upnext__progress">
            <div
              className="upnext__track"
              role="progressbar"
              aria-label={`${course.title} progress`}
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              {pct > 0 && <span style={{ width: `${pct}%` }} />}
            </div>
            <span className="upnext__count">
              {progress.done} of {progress.total} done
            </span>
          </div>
        )}
        <div className="upnext__actions">
          <Link href={href} className="upnext__primary">
            {starting ? 'Start lesson' : 'Continue lesson'}
          </Link>
          <Link href={`/courses/${course.slug}`} className="upnext__secondary">
            See the whole course
          </Link>
        </div>
      </div>
    </section>
  )
}
