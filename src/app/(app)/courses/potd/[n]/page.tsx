import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  fetchContentItem,
  fetchUserSettings,
} from '@/lib/content-queries'
import { fetchOrgPotdLaunch } from '@/lib/org-queries'
import { computeUnlockedThroughDay } from '@/lib/potd-unlock'
import { BodyClass } from '@/components/app/BodyClass'
import { ContentPlayer } from '@/components/courses/ContentPlayer'
import { MarkCompleteButton } from '@/components/courses/MarkCompleteButton'

type RouteParams = { n: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { n } = await params
  return { title: `POTD ${n}` }
}

export default async function PotdItemPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { n: nStr } = await params
  const n = parseInt(nStr, 10)
  if (!Number.isFinite(n) || n < 1) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [item, settings] = await Promise.all([
    fetchContentItem(supabase, 'potd', n),
    fetchUserSettings(supabase, user.id),
  ])
  if (!item) notFound()

  // Compute the org's current unlock window. Individuals (no org_id) and
  // orgs that haven't launched yet both end up with unlockedThroughDay = 0.
  const launch = settings.orgId
    ? await fetchOrgPotdLaunch(supabase, settings.orgId)
    : null
  const unlockedThroughDay = computeUnlockedThroughDay({
    launchedAt: launch?.launchedAt ?? null,
    timezone: settings.timezone,
  })

  if (item.sequence_num > unlockedThroughDay) {
    return (
      <>
        <BodyClass className="page-dashboard" />
        <main className="courses-main courses-main--narrow course-theme-potd">
          <Link href="/courses/potd" className="lesson-back-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Pod of the Day
          </Link>
          <div className="lesson-header">
            <p className="section-eyebrow">POTD</p>
            <h1>Episode {item.sequence_num} is locked</h1>
          </div>
          <div className="potd-launch-notice">
            <div>
              <strong>This episode isn&apos;t available yet.</strong>
              <p>
                {launch
                  ? `Episode ${unlockedThroughDay} is the latest one open today. Episode ${item.sequence_num} unlocks in ${
                      item.sequence_num - unlockedThroughDay
                    } day${item.sequence_num - unlockedThroughDay === 1 ? '' : 's'}.`
                  : 'POTD episodes unlock one per day after your team launches the feed.'}
              </p>
            </div>
          </div>
        </main>
      </>
    )
  }

  const { data: progress } = await supabase
    .from('content_progress')
    .select('id')
    .eq('user_id', user.id)
    .eq('content_item_id', item.id)
    .maybeSingle()

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main courses-main--narrow course-theme-potd">
        <Link href="/courses/potd" className="lesson-back-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Pod of the Day
        </Link>

        <div className="lesson-header">
          <p className="section-eyebrow">POTD</p>
          <h1>{item.title ?? `Episode ${item.sequence_num}`}</h1>
        </div>

        <div className="lesson-body">
          <ContentPlayer
            mediaUrl={item.media_url}
            mediaKind="audio"
            title={item.title ?? `POTD ${item.sequence_num}`}
          />
          {item.description && (
            <p className="content-description">{item.description}</p>
          )}
          <div className="lesson-complete-section">
            <MarkCompleteButton
              userId={user.id}
              contentItemId={item.id}
              initialDone={!!progress}
            />
          </div>
        </div>
      </main>
    </>
  )
}
