import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'
import { fetchCourseMap } from '@/lib/course-queries'
import { AssignmentsSection } from '@/components/dashboard/AssignmentsSection'
import { RequiredCoursesSection } from '@/components/dashboard/RequiredCoursesSection'
import { DailyPodWidget } from '@/components/dashboard/DailyPodWidget'
import { UpNextCard } from '@/components/dashboard/UpNextCard'
import { WeekCard } from '@/components/dashboard/WeekCard'
import { JourneyStrip } from '@/components/dashboard/JourneyStrip'
import { PutItToWork } from '@/components/dashboard/PutItToWork'
import { ProgramList } from '@/components/dashboard/ProgramList'
import { fetchLatestActivityAnswer, fetchMachineJourney } from '@/lib/dashboard-queries'
import { partOrdinal } from '@/lib/machine-queries'
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

  // The 5D Machine climb (Part-by-Part strip + "Up next") and the member's
  // latest activity answer ("Put it to work"). Both are optional sections
  // and never throw.
  const machineCourse = courseMap.get('machine')
  const [journey, latestAnswer] = await Promise.all([
    machineCourse?.isPublished
      ? fetchMachineJourney(supabase, completedItemIds)
      : Promise.resolve(null),
    fetchLatestActivityAnswer(supabase, user.id),
  ])
  // One source for the 5D Machine's numbers: the journey (lessons in
  // published Parts), so Up next, the Part strip, the program list and the
  // header % always agree.
  if (journey) {
    totals.machine = journey.totalLessons
    doneCounts.machine = journey.doneLessons
  }

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



  // ── Up next: the ONE thing to do now ──
  // Where they left off; in the 5D Machine that's the first unfinished
  // lesson in course order (not merely the next sequence number). A member
  // who hasn't started gets the first lesson of the program.
  type UpNext = Parameters<typeof UpNextCard>[0]
  let upNext: UpNext | null = null
  const resumeCourse = resumeTarget ? courseMap.get(resumeTarget.courseSlug) : undefined
  if (resumeTarget && resumeCourse && resumeTarget.courseSlug !== 'machine') {
    const isMba = resumeTarget.courseSlug === 'mba'
    if (!isMba || resumeTarget.mbaVersion) {
      upNext = {
        course: resumeCourse,
        href: isMba
          ? `/courses/mba/${resumeTarget.mbaVersion}/${resumeTarget.sequenceNum}`
          : `/courses/${resumeTarget.courseSlug}/${resumeTarget.sequenceNum}`,
        tileLabel: String(resumeTarget.sequenceNum),
        title: resumeTarget.itemTitle ?? `${resumeCourse.shortTitle} ${resumeTarget.sequenceNum}`,
        meta: isMba
          ? `${resumeCourse.title} · ${resumeTarget.mbaVersion} version`
          : resumeCourse.title,
        starting: false,
        progress: {
          done: doneCounts[resumeCourse.slug] ?? 0,
          total: totals[resumeCourse.slug] ?? 0,
        },
      }
    }
  }
  if (!upNext && journey?.next && machineCourse) {
    const n = journey.next
    upNext = {
      course: machineCourse,
      href: `/courses/machine/${n.sequenceNum}`,
      tileLabel: n.address,
      title: n.title ?? `Lesson ${n.address}`,
      meta: `${machineCourse.title} · Part ${partOrdinal(n.partNumber)} · ${n.partTitle}`,
      starting: journey.doneLessons === 0,
      progress: { done: journey.doneLessons, total: journey.totalLessons },
    }
  }
  // No Part-based journey (legacy flat 5D Machine, or its read failed): fall
  // back to where they left off, as the old resume card did. Not when the
  // journey exists but is finished — then there's genuinely nothing next.
  if (!upNext && !journey && resumeTarget?.courseSlug === 'machine' && resumeCourse) {
    upNext = {
      course: resumeCourse,
      href: `/courses/machine/${resumeTarget.sequenceNum}`,
      tileLabel: String(resumeTarget.sequenceNum),
      title: resumeTarget.itemTitle ?? `${resumeCourse.shortTitle} ${resumeTarget.sequenceNum}`,
      meta: resumeCourse.title,
      starting: false,
      progress: { done: doneCounts.machine ?? 0, total: totals.machine ?? 0 },
    }
  }

  const programRows = programCourses.map((course) => ({
    course,
    done: doneCounts[course.slug] ?? 0,
    total: totals[course.slug] ?? 0,
  }))

  // Header: today's date and a time-of-day greeting in the member's zone.
  const now = new Date()
  let dateLabel = ''
  let hour = 12
  try {
    dateLabel = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(now)
    hour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hourCycle: 'h23',
      }).format(now)
    )
  } catch {
    // Unknown zone: no date line, neutral greeting.
  }
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const streak = streakData.streak

  return (
    <>
      <BodyClass className="page-dashboard" />

      <div className="dash-content">
        <div className="dash-layout dash-stack">
          <header className="dash-top">
            <div>
              {dateLabel && <p className="dash-top__date">{dateLabel}</p>}
              <h1 className="dash-top__greeting">
                {greeting}, {firstName}
              </h1>
            </div>
            <div className="dash-top__pills">
              <span className="dash-pill">
                <svg className="dash-pill__flame" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
                  />
                </svg>
                {streak > 0 ? `${streak}-day streak` : 'Start a streak today'}
              </span>
              <span className="dash-pill">
                <svg viewBox="0 0 36 36" width="18" height="18" aria-hidden="true">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="5" />
                  {pctProgram > 0 && (
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="#5b4fff"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={`${(pctProgram / 100) * 88} 88`}
                      transform="rotate(-90 18 18)"
                    />
                  )}
                </svg>
                {allDone ? 'Program complete' : `${pctProgram}% of the program`}
              </span>
            </div>
          </header>

          {upNext && <UpNextCard {...upNext} />}

          <div className="dash-pair">
            <DailyPodWidget episode={featuredPod} done={featuredPodDone} />
            <WeekCard data={streakData} />
          </div>

          {journey && machineCourse && <JourneyStrip journey={journey} course={machineCourse} />}

          {latestAnswer && <PutItToWork answer={latestAnswer} />}

          {/* Manager-directed work */}
          <RequiredCoursesSection courses={requiredCourses} />
          <AssignmentsSection assignments={pendingAssignments} />

          <ProgramList rows={programRows} />

          {/* ── Your Partner: the brand behind the member's free access ── */}
          {partnerBranding && (
            <section className="dash-partner" aria-label="Your partner">
              {partnerBranding.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img className="dash-partner__logo" src={partnerBranding.avatarUrl} alt="" />
              ) : (
                <div className="dash-partner__logo dash-partner__logo--empty" aria-hidden="true">
                  {partnerBranding.name.trim().charAt(0).toUpperCase() || 'P'}
                </div>
              )}
              <div className="dash-partner__body">
                <p className="dash-partner__eyebrow">Your partner</p>
                <p className="dash-partner__name">{partnerBranding.name}</p>
                {partnerBranding.description && (
                  <p className="dash-partner__desc">{partnerBranding.description}</p>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
