import Link from 'next/link'
import { Fragment } from 'react'
import { createClient } from '@/lib/supabase/server'
import { fetchCourses } from '@/lib/course-queries'
import {
  fetchTotalsByType,
  fetchCompletedCountsByType,
} from '@/lib/content-queries'
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

  const [courses, totals, completed] = await Promise.all([
    fetchCourses(supabase),
    fetchTotalsByType(supabase),
    fetchCompletedCountsByType(supabase, user.id),
  ])

  // Program courses make up the grid; bonus tracks (in_program = false,
  // e.g. the Daily Pod) get a lighter link below.
  const programCourses = courses.filter((c) => c.inProgram)
  const bonusCourses = courses.filter((c) => !c.inProgram)

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main">
        <div className="courses-header">
          <p className="section-eyebrow">The Umbrella Program</p>
          <h1>Courses</h1>
          <p className="courses-header__blurb">
            The tracks that make up the Umbrella Program. Work through them in
            any order — or let your organization assign specific segments to
            your role.
          </p>
        </div>

        <div className="courses-grid">
          {programCourses.map((c) => (
            <CourseCard
              key={c.slug}
              course={c}
              href={`/courses/${c.slug}`}
              completedCount={completed[c.slug] ?? 0}
              totalCount={totals[c.slug] ?? 0}
            />
          ))}
        </div>

        {bonusCourses.length > 0 && (
          <p className="courses-bonus-link">
            Looking for bonus content?{' '}
            {bonusCourses.map((c, i) => (
              <Fragment key={c.slug}>
                {i > 0 && ' · '}
                <Link href={`/courses/${c.slug}`}>Open {c.title} →</Link>
              </Fragment>
            ))}
          </p>
        )}
      </main>
    </>
  )
}
