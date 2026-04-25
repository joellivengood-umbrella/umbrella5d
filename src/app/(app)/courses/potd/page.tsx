import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCourseMeta } from '@/lib/courses'
import {
  fetchContentItems,
  fetchCompletedItemIds,
  fetchUserSettings,
} from '@/lib/content-queries'
import { fetchOrgPotdLaunch, fetchUserOrgRole } from '@/lib/org-queries'
import { computeUnlockedThroughDay } from '@/lib/potd-unlock'
import { BodyClass } from '@/components/app/BodyClass'
import { ContentItemTile } from '@/components/courses/ContentItemTile'
import { LaunchPotdButton } from '@/components/courses/LaunchPotdButton'

export const metadata = { title: 'Pod of the Day' }

export default async function PotdIndexPage() {
  const meta = getCourseMeta('potd')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [items, completed, settings] = await Promise.all([
    fetchContentItems(supabase, 'potd'),
    fetchCompletedItemIds(supabase, user.id),
    fetchUserSettings(supabase, user.id),
  ])

  // Org-scoped POTD launch state. Individuals (no org_id) can't launch
  // POTD yet — the manager flow assumes an org.
  const [launch, role] = settings.orgId
    ? await Promise.all([
        fetchOrgPotdLaunch(supabase, settings.orgId),
        fetchUserOrgRole(supabase, user.id, settings.orgId),
      ])
    : [null, null]

  const unlockedThroughDay = computeUnlockedThroughDay({
    launchedAt: launch?.launchedAt ?? null,
    timezone: settings.timezone,
  })

  const isOrgAdmin = role === 'admin'
  const isLaunched = !!launch

  const visibleItems = settings.showCompleted
    ? items
    : items.filter((i) => !completed.has(i.id))

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main course-theme-potd">
        <Link href="/courses" className="lesson-back-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          All Courses
        </Link>

        <div className="courses-header">
          <p className="section-eyebrow">{meta.shortTitle}</p>
          <h1>{meta.title}</h1>
          <p className="courses-header__blurb">{meta.blurb}</p>
        </div>

        {!isLaunched && (
          <div className="potd-launch-notice">
            <div>
              {!settings.orgId ? (
                <>
                  <strong>POTD runs at the team level.</strong>
                  <p>
                    Daily episodes unlock once your team launches POTD. If
                    you&apos;re joining an organization, ask your account
                    manager for an invite code.
                  </p>
                </>
              ) : isOrgAdmin ? (
                <>
                  <strong>POTD isn&apos;t running for your team yet.</strong>
                  <p>
                    Launch the daily feed and episode 1 unlocks today. A new
                    episode then unlocks each day, in your team&apos;s local
                    time.
                  </p>
                  <LaunchPotdButton orgId={settings.orgId} userId={user.id} />
                </>
              ) : (
                <>
                  <strong>POTD isn&apos;t running for your team yet.</strong>
                  <p>
                    Once your account manager launches the daily feed, a new
                    episode will unlock each day.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        <div className="content-item-list">
          {visibleItems.map((item) => {
            const isUnlocked = item.sequence_num <= unlockedThroughDay
            return (
              <ContentItemTile
                key={item.id}
                href={`/courses/potd/${item.sequence_num}`}
                number={item.sequence_num}
                title={item.title ?? `POTD ${item.sequence_num}`}
                durationMins={item.duration_mins}
                done={completed.has(item.id)}
                locked={!isUnlocked}
                lockedLabel="Locked"
              />
            )
          })}
        </div>
      </main>
    </>
  )
}
