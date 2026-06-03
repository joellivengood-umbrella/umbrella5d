import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UMBRELLA_PROGRAM_COURSES } from '@/lib/courses'
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

  const [totals, completed] = await Promise.all([
    fetchTotalsByType(supabase),
    fetchCompletedCountsByType(supabase, user.id),
  ])

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main">
        <div className="courses-header">
          <p className="section-eyebrow">The Umbrella Program</p>
          <h1>Courses</h1>
          <p className="courses-header__blurb">
            Three tracks of content that make up the Umbrella Program. Work
            through them in any order — or let your organization assign
            specific segments to your role.
          </p>
        </div>

        <div className="courses-grid">
          {UMBRELLA_PROGRAM_COURSES.map((c) => (
            <CourseCard
              key={c.slug}
              slug={c.slug}
              href={`/courses/${c.slug}`}
              completedCount={completed[c.slug] ?? 0}
              totalCount={totals[c.slug] ?? 0}
            />
          ))}
        </div>

        <p className="courses-bonus-link">
          Looking for the daily bonus?{' '}
          <Link href="/courses/potd">Open the Daily Pod →</Link>
        </p>
      </main>
    </>
  )
}
