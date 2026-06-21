import { createClient } from '@/lib/supabase/server'
import { fetchCourses } from '@/lib/course-queries'
import {
  fetchTotalsByType,
  fetchCompletedCountsByType,
} from '@/lib/content-queries'
import { fetchMyPartnerBranding } from '@/lib/org-queries'
import { CourseCard } from '@/components/courses/CourseCard'
import { BodyClass } from '@/components/app/BodyClass'

export const metadata = {
  title: 'Courses',
}

export default async function CoursesIndexPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [courses, totals, completed, partnerBranding] = await Promise.all([
    fetchCourses(supabase),
    fetchTotalsByType(supabase),
    fetchCompletedCountsByType(supabase, user.id),
    fetchMyPartnerBranding(supabase),
  ])

  // The catalog shows every published course as a card (filtered here so an
  // admin's draft courses don't leak into the learner view via RLS).
  const published = courses.filter((c) => c.isPublished)

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main">
        <div className="courses-header">
          {partnerBranding && (
            <div className="courses-cobrand">
              <span className="courses-cobrand__by">Brought to you by</span>
              {partnerBranding.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  className="courses-cobrand__logo"
                  src={partnerBranding.avatarUrl}
                  alt=""
                />
              ) : (
                <span
                  className="courses-cobrand__logo courses-cobrand__logo--empty"
                  aria-hidden="true"
                >
                  {partnerBranding.name.trim().charAt(0).toUpperCase() || 'P'}
                </span>
              )}
              <span className="courses-cobrand__name">
                {partnerBranding.name}
              </span>
            </div>
          )}
          <p className="section-eyebrow">The Umbrella Program</p>
          <h1>Courses</h1>
          <p className="courses-header__blurb">
            Every course in the library. Work through them in any order — or let
            your organization assign specific segments to your role.
          </p>
        </div>

        <div className="courses-grid">
          {published.map((c) => (
            <CourseCard
              key={c.slug}
              course={c}
              href={`/courses/${c.slug}`}
              completedCount={completed[c.slug] ?? 0}
              totalCount={totals[c.slug] ?? 0}
            />
          ))}
        </div>
      </main>
    </>
  )
}
