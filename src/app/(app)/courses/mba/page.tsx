import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MBA_VERSIONS, courseThemeVars } from '@/lib/courses'
import { fetchCourse } from '@/lib/course-queries'
import { fetchContentItems, fetchCompletedItemIds } from '@/lib/content-queries'
import { BodyClass } from '@/components/app/BodyClass'

export const metadata = {
  title: 'MBA Seminars',
}

export default async function MbaHubPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const course = await fetchCourse(supabase, 'mba')
  if (!course) notFound()

  // Count segments per version + user's completions, in parallel.
  const [items5, items3, items2, items1, completed] = await Promise.all([
    fetchContentItems(supabase, 'mba', '5hr'),
    fetchContentItems(supabase, 'mba', '3hr'),
    fetchContentItems(supabase, 'mba', '2hr'),
    fetchContentItems(supabase, 'mba', '1hr'),
    fetchCompletedItemIds(supabase, user.id),
  ])

  const itemsByVersion = {
    '5hr': items5,
    '3hr': items3,
    '2hr': items2,
    '1hr': items1,
  } as const

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
          <h1>Pick your length</h1>
          <p className="courses-header__blurb">
            The same seminar, cut to different durations. Your organization can
            assign the version that fits each role.
          </p>
        </div>

        <div className="mba-version-grid">
          {MBA_VERSIONS.map((v) => {
            const items = itemsByVersion[v.slug]
            const total = items.length
            const done = items.filter((i) => completed.has(i.id)).length
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            return (
              <Link
                key={v.slug}
                href={`/courses/mba/${v.slug}`}
                className="course-card course-theme-mba"
              >
                <div className="course-card__header">
                  <span className="course-card__eyebrow">
                    {v.hours} HOUR
                  </span>
                  <h3 className="course-card__title">{v.label}</h3>
                </div>
                <p className="course-card__blurb">
                  {total} segment{total === 1 ? '' : 's'} — a{' '}
                  {v.hours}-hour walkthrough of the full seminar.
                </p>
                <div className="course-card__footer">
                  <div className="course-card__progress">
                    <div
                      className="course-card__progress-bar"
                      style={{ width: `${pct}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="course-card__progress-label">
                    {done} / {total} complete
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </main>
    </>
  )
}
