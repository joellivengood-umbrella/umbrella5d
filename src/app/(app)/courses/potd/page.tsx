import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCourseMeta } from '@/lib/courses'
import {
  fetchContentItems,
  fetchCompletedItemIds,
  fetchUserSettings,
} from '@/lib/content-queries'
import { fetchMemberAssignments } from '@/lib/org-queries'
import { BodyClass } from '@/components/app/BodyClass'
import { ContentItemTile } from '@/components/courses/ContentItemTile'

export const metadata = { title: 'Daily Pod' }

export default async function PotdIndexPage() {
  const meta = getCourseMeta('potd')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [items, completed, settings, assignments] = await Promise.all([
    fetchContentItems(supabase, 'potd'),
    fetchCompletedItemIds(supabase, user.id),
    fetchUserSettings(supabase, user.id),
    fetchMemberAssignments(supabase, user.id),
  ])

  const assignedItemIds = new Set(assignments.map((a) => a.contentItemId))

  // "X / Y heard" — every published POTD episode is available to
  // everyone; Y grows naturally as the admin adds new pods.
  const totalEpisodes = items.length
  const heardEpisodes = items.filter((i) => completed.has(i.id)).length

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
          <p className="section-eyebrow">Daily Pod · Bonus</p>
          <h1>{meta.title}</h1>
          <p className="courses-header__blurb">{meta.blurb}</p>
          {totalEpisodes > 0 && (
            <p className="potd-heard-count">
              You&apos;ve heard <strong>{heardEpisodes} / {totalEpisodes}</strong> episodes.
            </p>
          )}
        </div>

        <div className="content-item-list">
          {visibleItems.map((item) => (
            <ContentItemTile
              key={item.id}
              href={`/courses/potd/${item.sequence_num}`}
              number={item.sequence_num}
              title={item.title ?? `POTD ${item.sequence_num}`}
              durationMins={item.duration_mins}
              done={completed.has(item.id)}
              assigned={assignedItemIds.has(item.id)}
            />
          ))}
        </div>
      </main>
    </>
  )
}
