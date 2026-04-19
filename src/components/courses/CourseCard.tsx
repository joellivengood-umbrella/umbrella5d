import Link from 'next/link'
import { COURSES, type CourseSlug } from '@/lib/courses'

/**
 * Tile used on /courses index and anywhere else a course needs to be
 * presented as a clickable card. Shows title, blurb, and a progress %.
 */
export function CourseCard({
  slug,
  href,
  completedCount,
  totalCount,
}: {
  slug: CourseSlug
  href: string
  completedCount: number
  totalCount: number
}) {
  const meta = COURSES.find((c) => c.slug === slug)!
  const pct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <Link href={href} className="course-card">
      <div className="course-card__header">
        <span className="course-card__eyebrow">{meta.shortTitle}</span>
        <h3 className="course-card__title">{meta.title}</h3>
      </div>
      <p className="course-card__blurb">{meta.blurb}</p>
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
