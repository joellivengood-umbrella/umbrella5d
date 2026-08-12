import Link from 'next/link'
import type { AssignmentEntry } from '@/lib/org-queries'

/**
 * Dashboard section listing items a manager has assigned to the
 * current user. Filtered upstream to only unfinished items, so the
 * list stays actionable — once you complete an assignment, it falls
 * off the dashboard.
 *
 * Renders nothing if there are no unfinished assignments. The caller
 * can also use the AssignmentEntry array's length to decide whether
 * to render at all.
 *
 */
export function AssignmentsSection({
  assignments,
}: {
  assignments: AssignmentEntry[]
}) {
  if (assignments.length === 0) return null

  return (
    <section className="assignments-section">
      <header className="assignments-section__header">
        <h2 className="assignments-section__title">Assigned to you</h2>
        <span className="assignments-section__count">
          {assignments.length} item{assignments.length === 1 ? '' : 's'}
        </span>
      </header>

      <ul className="assignments-section__list">
        {assignments.map((a) => {
          const courseLabel = formatCourseLabel(a.type, a.metadataVersion)
          const itemTitle = a.title ?? `${courseLabel} ${a.sequenceNum}`
          const href = buildHref(a)

          return (
            <li key={a.id} className="assignments-section__row">
              <Link href={href} className="assignments-section__link">
                <span
                  className={`assignment-row__course course-tag-${a.type}`}
                >
                  {courseLabel}
                </span>
                <span className="assignments-section__item">
                  <span className="assignments-section__num">
                    #{a.sequenceNum}
                  </span>
                  {a.title && (
                    <span className="assignments-section__title-text">
                      {a.title}
                    </span>
                  )}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="16"
                  height="16"
                  aria-hidden="true"
                  className="assignments-section__chevron"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="visually-hidden">Open {itemTitle}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function buildHref(a: AssignmentEntry): string {
  if (a.type === 'mba' && a.metadataVersion) {
    return `/courses/mba/${a.metadataVersion}/${a.sequenceNum}`
  }
  return `/courses/${a.type}/${a.sequenceNum}`
}

function formatCourseLabel(
  type: 'mba' | 'eos' | 'potd' | 'machine',
  version: string | null
): string {
  switch (type) {
    case 'mba':
      return version ? `MBA ${version}` : 'MBA'
    case 'eos':
      return 'EOS'
    case 'potd':
      return 'POTD'
    case 'machine':
      return '5D Machine'
  }
}
