import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'
import { fetchCourseMap } from '@/lib/course-queries'
import { CourseCard } from '@/components/courses/CourseCard'
import { ResumeCard } from '@/components/dashboard/ResumeCard'
import { AssignmentsSection } from '@/components/dashboard/AssignmentsSection'
import { RequiredCoursesSection } from '@/components/dashboard/RequiredCoursesSection'
import { DailyPodWidget } from '@/components/dashboard/DailyPodWidget'
import { StreakBanner } from '@/components/dashboard/StreakBanner'
import {
  fetchTotalsByType,
  fetchCompletedCountsByType,
  fetchCompletedItemIds,
  fetchPotdEpisodeStubs,
  fetchResumeTarget,
  fetchStreak,
} from '@/lib/content-queries'
import {
  fetchMemberAssignments,
  fetchRequiredCourseSlugs,
  fetchUserPartner,
  fetchMyPartnerBranding,
} from '@/lib/org-queries'

export const metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Partners have no learner dashboard — the sidebar hides these tabs and
  // their home is the Partner panel. Send them there so a manual /dashboard
  // visit (or a stale link) doesn't dump them on an empty learner page.
  const partner = await fetchUserPartner(supabase, user.id)
  if (partner) redirect('/partner')

  const [{ data: profile }, courseMap, totals, doneCounts, partnerBranding] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, timezone')
        .eq('id', user.id)
        .single(),
      fetchCourseMap(supabase),
      fetchTotalsByType(supabase),
      fetchCompletedCountsByType(supabase, user.id),
      // The partner that provides this member's program (co-brand), or null.
      fetchMyPartnerBranding(supabase),
    ])

  // Program courses (in_program), in sort_order — the dashboard grid and the
  // headline progress math. Bonus tracks (e.g. POTD) are excluded so an
  // ever-growing catalog can't drag the completion bar down.
  const programCourses = [...courseMap.values()].filter(
    (c) => c.inProgram && c.isPublished
  )

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const timezone =
    (profile?.timezone as string | undefined) || 'America/Chicago'

  // Resume card scopes to Umbrella Program only — POTD is bonus
  // content, not "where you left off."
  const resumeTarget = await fetchResumeTarget(supabase, user.id)

  // Assignments + completed-item IDs + all POTD episodes in parallel.
  // pendingAssignments = unfinished; powers the AssignmentsSection.
  // The pod list + completions drive the Daily Pod widget below.
  const [
    allAssignments,
    completedItemIds,
    potdEpisodes,
    streakData,
    requiredCourseSlugs,
  ] = await Promise.all([
    fetchMemberAssignments(supabase, user.id),
    fetchCompletedItemIds(supabase, user.id),
    fetchPotdEpisodeStubs(supabase),
    fetchStreak(supabase, user.id, timezone),
    fetchRequiredCourseSlugs(supabase, user.id),
  ])
  const pendingAssignments = allAssignments.filter(
    (a) => !completedItemIds.has(a.contentItemId)
  )

  // Courses assigned to the user's team(s), in sort_order, with the user's
  // own progress. Resolving each assigned slug against the live course map
  // validates it (a stale/unknown slug is dropped) and pulls its display
  // metadata — the courses table is the single source of truth here.
  const requiredSlugs = new Set(requiredCourseSlugs)
  const requiredCourses = [...courseMap.values()]
    .filter((c) => requiredSlugs.has(c.slug))
    .map((course) => ({
      course,
      completed: doneCounts[course.slug] ?? 0,
      total: totals[course.slug] ?? 0,
    }))

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

  // Program progress math — in-program courses only. Bonus tracks (POTD)
  // are excluded so an ever-growing catalog can't drag the completion bar
  // down. New courses start as bonus (in_program = false), so publishing one
  // never retroactively lowers everyone's %.
  const totalProgram = programCourses.reduce(
    (sum, c) => sum + (totals[c.slug] ?? 0),
    0
  )
  const doneProgram = programCourses.reduce(
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

          {/* ── Sponsor banner: who provides this member's program ── */}
          {partnerBranding && (
            <div className="dash-sponsor">
              {partnerBranding.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  className="dash-sponsor__logo"
                  src={partnerBranding.avatarUrl}
                  alt=""
                />
              ) : (
                <div
                  className="dash-sponsor__logo dash-sponsor__logo--empty"
                  aria-hidden="true"
                >
                  {partnerBranding.name.trim().charAt(0).toUpperCase() || 'P'}
                </div>
              )}
              <p className="dash-sponsor__text">
                Your Umbrella Program is provided by{' '}
                <strong>{partnerBranding.name}</strong> — free.
              </p>
            </div>
          )}

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

          {/* ── Streak (habit focal point) ── */}
          <StreakBanner data={streakData} />

          {/* ── Required for your team (manager-assigned courses) ── */}
          <RequiredCoursesSection courses={requiredCourses} />

          {/* ── Assigned to you (manager-directed work) ── */}
          <AssignmentsSection assignments={pendingAssignments} />

          {/* ── Continue Where You Left Off ── */}
          {resumeTarget && courseMap.has(resumeTarget.courseSlug) && (
            <ResumeCard
              target={resumeTarget}
              course={courseMap.get(resumeTarget.courseSlug)!}
            />
          )}

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
            {programCourses.map((course) => (
              <CourseCard
                key={course.slug}
                course={course}
                href={`/courses/${course.slug}`}
                completedCount={doneCounts[course.slug] ?? 0}
                totalCount={totals[course.slug] ?? 0}
              />
            ))}
          </div>

          {/* ── Your Partner: the brand behind the member's free access ── */}
          {partnerBranding && (
            <section className="dash-partner" aria-label="Your partner">
              {partnerBranding.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  className="dash-partner__logo"
                  src={partnerBranding.avatarUrl}
                  alt=""
                />
              ) : (
                <div
                  className="dash-partner__logo dash-partner__logo--empty"
                  aria-hidden="true"
                >
                  {partnerBranding.name.trim().charAt(0).toUpperCase() || 'P'}
                </div>
              )}
              <div className="dash-partner__body">
                <p className="dash-partner__eyebrow">Your partner</p>
                <p className="dash-partner__name">{partnerBranding.name}</p>
                {partnerBranding.description && (
                  <p className="dash-partner__desc">
                    {partnerBranding.description}
                  </p>
                )}
              </div>
            </section>
          )}

        </div>
      </div>
    </>
  )
}
