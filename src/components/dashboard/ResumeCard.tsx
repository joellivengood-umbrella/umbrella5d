import Link from 'next/link'
import { courseThemeVars, type Course } from '@/lib/courses'
import type { ResumeTarget } from '@/lib/content-queries'

/**
 * "Pick up where you left off" card on the dashboard.
 *
 * Takes a ResumeTarget (raw data from content-queries) plus the resolved
 * course (for label + theme) and builds the route href here. MBA keeps its
 * extra /[version]/ segment; every other course routes at /courses/{slug}/{n}.
 */
export function ResumeCard({
  target,
  course,
}: {
  target: ResumeTarget
  course: Course
}) {
  // MBA routes require a version segment. If we somehow received a MBA
  // target without one, render nothing rather than a broken link. The
  // helper that produces ResumeTarget already guards against this; this
  // is belt-and-suspenders.
  if (target.courseSlug === 'mba' && !target.mbaVersion) return null

  // Build the link. Only MBA has the extra version segment.
  const href =
    target.courseSlug === 'mba' && target.mbaVersion
      ? `/courses/mba/${target.mbaVersion}/${target.sequenceNum}`
      : `/courses/${target.courseSlug}/${target.sequenceNum}`

  // Course label, with version appended for MBA.
  const courseLabel =
    target.courseSlug === 'mba' && target.mbaVersion
      ? `${course.shortTitle} ${target.mbaVersion}`
      : course.shortTitle

  // Fallback to "POTD 4" / "MBA 5hr 12" if a row is missing its title.
  const itemLabel =
    target.itemTitle ?? `${courseLabel} ${target.sequenceNum}`

  return (
    <Link
      href={href}
      className="resume-card"
      style={courseThemeVars(course.theme)}
      aria-label={`Resume ${courseLabel}: ${itemLabel}`}
    >
      <div className="resume-card__body">
        <p className="resume-card__eyebrow">Pick up where you left off</p>
        <p className="resume-card__course">{courseLabel}</p>
        <p className="resume-card__title">{itemLabel}</p>
      </div>
      <div className="resume-card__cta">
        <span>Resume</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          width="18"
          height="18"
          aria-hidden="true"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
    </Link>
  )
}
