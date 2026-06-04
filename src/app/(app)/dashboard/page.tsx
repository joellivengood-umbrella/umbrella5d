import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'
import { UMBRELLA_PROGRAM_COURSES } from '@/lib/courses'
import { CourseCard } from '@/components/courses/CourseCard'
import { ResumeCard } from '@/components/dashboard/ResumeCard'
import { AssignmentsSection } from '@/components/dashboard/AssignmentsSection'
import { TodayPodWidget } from '@/components/dashboard/TodayPodWidget'
import {
  fetchTotalsByType,
  fetchCompletedCountsByType,
  fetchCompletedItemIds,
  fetchContentItem,
  fetchResumeTarget,
} from '@/lib/content-queries'
import {
  fetchOrgPotdLaunch,
  fetchMemberAssignments,
} from '@/lib/org-queries'
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

  // POTD launch state powers the TodayPodWidget. POTD is bonus content
  // and intentionally excluded from program progress math below.
  const launch = profile?.org_id
    ? await fetchOrgPotdLaunch(supabase, profile.org_id)
    : null
  const unlockedThroughDay = computeUnlockedThroughDay({
    launchedAt: launch?.launchedAt ?? null,
    timezone: profile?.timezone ?? 'America/Chicago',
  })

  // Today's POTD episode = the highest unlocked sequence_num. Only
  // fetch when there's actually something unlocked to show.
  const todayPotdItem =
    unlockedThroughDay > 0
      ? await fetchContentItem(supabase, 'potd', unlockedThroughDay)
      : null

  // Resume card now scopes to Umbrella Program only — POTD is bonus
  // content, not "where you left off."
  const resumeTarget = await fetchResumeTarget(supabase, user.id)

  // Pull the user's assignments + completed-item IDs in parallel.
  // pendingAssignments = unfinished; powers the AssignmentsSection.
  // completedItemIds also lets the TodayPodWidget show a "heard" state.
  const [allAssignments, completedItemIds] = await Promise.all([
    fetchMemberAssignments(supabase, user.id),
    fetchCompletedItemIds(supabase, user.id),
  ])
  const pendingAssignments = allAssignments.filter(
    (a) => !completedItemIds.has(a.contentItemId)
  )
  const todayPotdDone = todayPotdItem
    ? completedItemIds.has(todayPotdItem.id)
    : false

  // Program progress math — Umbrella Program only (BSS + EOS + Machine).
  // POTD is bonus content, intentionally excluded so an ever-growing
  // catalog of daily pods can't drag the completion bar down.
  const totalProgram = UMBRELLA_PROGRAM_COURSES.reduce(
    (sum, c) => sum + (totals[c.slug] ?? 0),
    0
  )
  const doneProgram = UMBRELLA_PROGRAM_COURSES.reduce(
    (sum, c) => sum + (doneCounts[c.slug] ?? 0),
    0
  )
  const pctProgram =
    totalProgram > 0 ? Math.round((doneProgram / totalProgram) * 100) : 0
  const allDone = doneProgram === totalProgram && totalProgram > 0

  return (
    <>
      <BodyClass className="page-dashboard" />

      <div className="dash-content">
        <div className="dash-layout">

          {/* ── Hero: greeting + featured Overall Progress (glass) ── */}
          <section className="dash-hero" aria-label="Your progress">
            <p className="dash-hero__greeting">Welcome back, {firstName}</p>
            <div className="dash-hero__glass">
              <div className="dash-hero__phead">
                <span className="dash-hero__plabel">Overall Progress</span>
                <span className="dash-hero__ppct" aria-live="polite">
                  {pctProgram}%
                </span>
              </div>
              <div
                className="dash-hero__track"
                role="progressbar"
                aria-valuenow={pctProgram}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="dash-hero__fill"
                  style={{ width: `${pctProgram}%` }}
                />
              </div>
              <p className="dash-hero__meta">
                {allDone
                  ? '🎉 Program complete!'
                  : `${doneProgram} of ${totalProgram} items complete across the program`}
              </p>
            </div>
          </section>

          {/* ── Assigned to you (manager-directed work) ── */}
          <AssignmentsSection
            assignments={pendingAssignments}
            unlockedThroughDay={unlockedThroughDay}
          />

          {/* ── Today's Pod (bonus daily content) ── */}
          <TodayPodWidget
            orgId={profile?.org_id ?? null}
            isLaunched={!!launch}
            todayItem={todayPotdItem}
            todayItemDone={todayPotdDone}
          />

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
                {doneProgram} / {totalProgram}
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
              <p className="stat-card__value">{pctProgram}%</p>
              <p className="stat-card__label">Overall Progress</p>
            </div>

            <div className="stat-card">
              <div className="stat-card__icon">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              </div>
              <p className="stat-card__value">
                {UMBRELLA_PROGRAM_COURSES.length}
              </p>
              <p className="stat-card__label">Courses Available</p>
            </div>
          </div>

          {/* ── Umbrella Program courses ── */}
          <div className="modules-header">
            <h2>The Umbrella Program</h2>
            <p>
              <Link href="/courses">Browse all courses →</Link>
            </p>
          </div>

          <div className="courses-grid">
            {UMBRELLA_PROGRAM_COURSES.map((course) => (
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
