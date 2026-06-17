import Link from 'next/link'
import { courseThemeVars, type Course } from '@/lib/courses'

/**
 * Tile used on /courses index and anywhere else a course needs to be
 * presented as a clickable card. Shows title, blurb, and a progress %.
 *
 * Themed from the course's own data (inline `--ct-*` vars), so a
 * dynamically-created course is fully coloured with no per-slug CSS.
 */
export function CourseCard({
  course,
  href,
  completedCount,
  totalCount,
}: {
  course: Course
  href: string
  completedCount: number
  totalCount: number
}) {
  const pct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <Link
      href={href}
      className="course-card"
      style={courseThemeVars(course.theme)}
    >
      <div className="course-card__header">
        <span className="course-card__eyebrow">{course.shortTitle}</span>
        <h3 className="course-card__title">{course.title}</h3>
      </div>
      <p className="course-card__blurb">{course.blurb}</p>
      <div className="course-card__footer">
        <div className="course-card__progress">
          <div
            className="course-card__progress-bar"
            style={{ width: `${pct}%` }}
            aria-hidden="true"
          />
        </div>
        <span className="course-card__progress-label">
          {completedCount} / {totalCount} complete
        </span>
      </div>
    </Link>
  )
}
