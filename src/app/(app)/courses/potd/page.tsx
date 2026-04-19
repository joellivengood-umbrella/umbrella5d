import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCourseMeta } from '@/lib/courses'
import {
  fetchContentItems,
  fetchCompletedItemIds,
  fetchUserSettings,
} from '@/lib/content-queries'
import { BodyClass } from '@/components/app/BodyClass'
import { ContentItemTile } from '@/components/courses/ContentItemTile'

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

  const visibleItems = settings.showCompleted
    ? items
    : items.filter((i) => !completed.has(i.id))

  // POTD unlocks one per day after a manager "launches" it for the org.
  // Branch 1: launch tracking isn't built yet — all items show as locked.
  // Branch 4 will add org_potd_launches table + compute the unlock window.
  const unlockedThroughDay = 0

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

        {unlockedThroughDay === 0 && (
          <div className="potd-launch-notice">
            <div>
              <strong>POTD isn&apos;t running for your organization yet.</strong>
              <p>
                Once a manager launches the daily pod feed, a new episode will
                unlock each day. Managers: the launch control is coming in a
                future update.
              </p>
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
