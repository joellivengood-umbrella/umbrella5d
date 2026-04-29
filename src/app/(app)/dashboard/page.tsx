import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'
import { COURSES } from '@/lib/courses'
import { CourseCard } from '@/components/courses/CourseCard'
import { ResumeCard } from '@/components/dashboard/ResumeCard'
import {
  fetchTotalsByType,
  fetchCompletedCountsByType,
  fetchResumeTarget,
} from '@/lib/content-queries'
import { fetchOrgPotdLaunch } from '@/lib/org-queries'
import { computeUnlockedThroughDay } from '@/lib/potd-unlock'

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
    supabase
      .from('profiles')
      .select('full_name, org_id, timezone')
      .eq('id', user.id)
      .single(),
    fetchTotalsByType(supabase),
    fetchCompletedCountsByType(supabase, user.id),
  ])

  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  // Compute the user's POTD unlock window so fetchResumeTarget can avoid
  // suggesting a still-locked episode. Individuals (no org_id) and orgs
  // that haven't launched POTD both end up with unlockedThroughDay = 0.
  const launch = profile?.org_id
    ? await fetchOrgPotdLaunch(supabase, profile.org_id)
    : null
  const unlockedThroughDay = computeUnlockedThroughDay({
    launchedAt: launch?.launchedAt ?? null,
    timezone: profile?.timezone ?? 'America/Chicago',
  })

  const resumeTarget = await fetchResumeTarget(
    supabase,
    user.id,
    unlockedThroughDay
  )

  const totalAll = COURSES.reduce((sum, c) => sum + (totals[c.slug] ?? 0), 0)
  const doneAll = COURSES.reduce((sum, c) => sum + (doneCounts[c.slug] ?? 0), 0)
  const pctAll = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0
  const allDone = doneAll === totalAll && totalAll > 0

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

          {/* ── Continue Where You Left Off ── */}
          {resumeTarget && <ResumeCard target={resumeTarget} />}

          {/* ── Stat cards ── */}
          <div className="dash-stats">
            <div className="stat-card">
              <div className="stat-card__icon">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <p className="stat-card__value">
                {doneAll} / {totalAll}
              </p>
              <p className="stat-card__label">Items Completed</p>
            </div>

            <div className="stat-card">
              <div className="stat-card__icon">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <p className="stat-card__value">{pctAll}%</p>
              <p className="stat-card__label">Overall Progress</p>
            </div>

            <div className="stat-card">
              <div className="stat-card__icon">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              </div>
              <p className="stat-card__value">{COURSES.length}</p>
              <p className="stat-card__label">Courses Available</p>
            </div>
          </div>

          {/* ── Overall progress bar card ── */}
          <div className="progress-card" role="region" aria-label="Overall progress">
            <div className="progress-header">
              <h2 className="progress-title">Overall Progress</h2>
              <span
                className={`progress-pct${allDone ? ' is-done' : ''}`}
                aria-live="polite"
              >
                {pctAll}%
              </span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-valuenow={pctAll}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="progress-fill" style={{ width: `${pctAll}%` }} />
            </div>
            <p className="progress-meta">
              {allDone
                ? '🎉 All content complete!'
                : `${doneAll} of ${totalAll} items complete across all courses`}
            </p>
          </div>

          {/* ── Course cards ── */}
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
