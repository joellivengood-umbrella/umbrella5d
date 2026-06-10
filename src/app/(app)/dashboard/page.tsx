import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'
import { UMBRELLA_PROGRAM_COURSES } from '@/lib/courses'
import { CourseCard } from '@/components/courses/CourseCard'
import { ResumeCard } from '@/components/dashboard/ResumeCard'
import { AssignmentsSection } from '@/components/dashboard/AssignmentsSection'
import { DailyPodWidget } from '@/components/dashboard/DailyPodWidget'
import {
  fetchTotalsByType,
  fetchCompletedCountsByType,
  fetchCompletedItemIds,
  fetchPotdEpisodeStubs,
  fetchResumeTarget,
} from '@/lib/content-queries'
import { fetchMemberAssignments } from '@/lib/org-queries'

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
      .select('full_name')
      .eq('id', user.id)
      .single(),
    fetchTotalsByType(supabase),
    fetchCompletedCountsByType(supabase, user.id),
  ])

  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  // Resume card scopes to Umbrella Program only — POTD is bonus
  // content, not "where you left off."
  const resumeTarget = await fetchResumeTarget(supabase, user.id)

  // Assignments + completed-item IDs + all POTD episodes in parallel.
  // pendingAssignments = unfinished; powers the AssignmentsSection.
  // The pod list + completions drive the Daily Pod widget below.
  const [allAssignments, completedItemIds, potdEpisodes] = await Promise.all([
    fetchMemberAssignments(supabase, user.id),
    fetchCompletedItemIds(supabase, user.id),
    fetchPotdEpisodeStubs(supabase),
  ])
  const pendingAssignments = allAssignments.filter(
    (a) => !completedItemIds.has(a.contentItemId)
  )

  // Daily Pod widget: the next episode the user hasn't heard, or the
  // latest one if they're all caught up. POTD is available to everyone
  // now (no org launch / daily drip).
  const nextUnheardPod =
    potdEpisodes.find((e) => !completedItemIds.has(e.id)) ?? null
  const featuredPod =
    nextUnheardPod ??
    (potdEpisodes.length > 0
      ? potdEpisodes[potdEpisodes.length - 1]
      : null)
  const featuredPodDone = featuredPod
    ? completedItemIds.has(featuredPod.id)
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
                <span className="dash-hero__plabel">Program Progress</span>
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
                  className={`dash-hero__fill${pctProgram === 0 ? ' dash-hero__fill--empty' : ''}`}
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
          <AssignmentsSection assignments={pendingAssignments} />

          {/* ── Continue Where You Left Off ── */}
          {resumeTarget && <ResumeCard target={resumeTarget} />}

          {/* ── Daily Pod (bonus content) ── */}
          <DailyPodWidget episode={featuredPod} done={featuredPodDone} />

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
