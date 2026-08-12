import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { courseThemeVars } from '@/lib/courses'
import { fetchCourse } from '@/lib/course-queries'
import {
  fetchContentItems,
  fetchCompletedItemIds,
  fetchUserSettings,
} from '@/lib/content-queries'
import { fetchMemberAssignments } from '@/lib/org-queries'
import { BodyClass } from '@/components/app/BodyClass'
import { ContentItemTile } from '@/components/courses/ContentItemTile'

/**
 * Generic landing page for a flat course (a list of video/audio lessons),
 * driven entirely by the courses table. The four built-in courses
 * (mba/eos/potd/machine) have their own bespoke folders, which take
 * precedence over this dynamic [slug] segment — so this only ever serves
 * admin-created courses.
 */

type RouteParams = { slug: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const course = await fetchCourse(supabase, slug)
  return { title: course?.title ?? 'Course' }
}

export default async function CourseLandingPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const course = await fetchCourse(supabase, slug)
  if (!course) notFound()

  const [items, completed, settings, assignments] = await Promise.all([
    fetchContentItems(supabase, course.slug),
    fetchCompletedItemIds(supabase, user.id),
    fetchUserSettings(supabase, user.id),
    fetchMemberAssignments(supabase, user.id),
  ])

  const assignedItemIds = new Set(assignments.map((a) => a.contentItemId))
  const visibleItems = settings.showCompleted
    ? items
    : items.filter((i) => !completed.has(i.id))

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main" style={courseThemeVars(course.theme)}>
        <Link href="/courses" className="lesson-back-btn">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="15"
            height="15"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          All Courses
        </Link>

        <div className="courses-header">
          <p className="section-eyebrow">{course.shortTitle}</p>
          <h1>{course.title}</h1>
          {course.blurb && (
            <p className="courses-header__blurb">{course.blurb}</p>
          )}
        </div>

        {visibleItems.length > 0 ? (
          <div className="content-item-list">
            {visibleItems.map((item) => (
              <ContentItemTile
                key={item.id}
                href={`/courses/${course.slug}/${item.sequence_num}`}
                number={item.sequence_num}
                title={
                  item.title ?? `${course.shortTitle} ${item.sequence_num}`
                }
                durationMins={item.duration_mins}
                done={completed.has(item.id)}
                assigned={assignedItemIds.has(item.id)}
              />
            ))}
          </div>
        ) : (
          <div className="lesson-placeholder">
            <p>No lessons published yet.</p>
            <p className="lesson-placeholder-sub">
              Check back as this course rolls out.
            </p>
          </div>
        )}
      </main>
    </>
  )
}
