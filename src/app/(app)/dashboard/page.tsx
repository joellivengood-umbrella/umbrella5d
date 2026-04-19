import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'
import { COURSES } from '@/lib/courses'
import { CourseCard } from '@/components/courses/CourseCard'
import {
  fetchTotalsByType,
  fetchCompletedCountsByType,
} from '@/lib/content-queries'

export const metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, totals, doneCounts] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    fetchTotalsByType(supabase),
    fetchCompletedCountsByType(supabase, user.id),
  ])

  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  const totalAll = COURSES.reduce((sum, c) => sum + (totals[c.slug] ?? 0), 0)
  const doneAll = COURSES.reduce((sum, c) => sum + (doneCounts[c.slug] ?? 0), 0)
  const pctAll = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0

  return (
    <>
      <BodyClass className="page-dashboard" />

      <div className="dash-header">
        <p className="section-eyebrow">Your Learning Journey</p>
        <h1>Hey {firstName}! Welcome to your dashboard.</h1>
        <p className="dash-subtext">
          Work through any of the four courses below. Your manager may have
          assigned specific segments — check in with them if you&apos;re not
          sure where to start.
        </p>
      </div>

      <div className="dash-content">
        <div className="dash-layout">
          <div className="dash-stats">
            <div className="stat-card">
              <p className="stat-card__value">
                {doneAll} / {totalAll}
              </p>
              <p className="stat-card__label">Items Completed</p>
            </div>
            <div className="stat-card">
              <p className="stat-card__value">{pctAll}%</p>
              <p className="stat-card__label">Overall Progress</p>
            </div>
            <div className="stat-card">
              <p className="stat-card__value">{COURSES.length}</p>
              <p className="stat-card__label">Courses Available</p>
            </div>
          </div>

          <div className="modules-header">
            <h2>Your Courses</h2>
            <p>
              <Link href="/courses">Browse all courses →</Link>
            </p>
          </div>

          <div className="courses-grid">
            {COURSES.map((course) => (
              <CourseCard
                key={course.slug}
                slug={course.slug}
                href={`/courses/${course.slug}`}
                completedCount={doneCounts[course.slug] ?? 0}
                totalCount={totals[course.slug] ?? 0}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
