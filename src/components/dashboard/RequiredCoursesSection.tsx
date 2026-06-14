import { CourseCard } from '@/components/courses/CourseCard'
import type { CourseSlug } from '@/lib/courses'

/**
 * Dashboard section listing the courses a manager has assigned to the
 * current user's team(s) — what they're required to complete. Each course
 * is a familiar CourseCard showing the member's own progress and linking
 * into the course.
 *
 * Renders nothing if the user has no required courses (no team
 * assignments). Completed courses stay listed at 100% — a manager-assigned
 * requirement is a standing fact, not a transient to-do (unlike the
 * per-item "Assigned to you" list, which drops finished items).
 */
export function RequiredCoursesSection({
  courses,
}: {
  courses: { slug: CourseSlug; completed: number; total: number }[]
}) {
  if (courses.length === 0) return null

  return (
    <section className="assignments-section">
      <header className="assignments-section__header">
        <h2 className="assignments-section__title">Required for your team</h2>
        <span className="assignments-section__count">
          {courses.length} course{courses.length === 1 ? '' : 's'}
        </span>
      </header>

      <div className="courses-grid">
        {courses.map((c) => (
          <CourseCard
            key={c.slug}
            slug={c.slug}
            href={`/courses/${c.slug}`}
            completedCount={c.completed}
            totalCount={c.total}
          />
        ))}
      </div>
    </section>
  )
}
