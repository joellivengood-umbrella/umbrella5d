import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isValidBssVersion, BSS_VERSIONS, type BssVersion } from '@/lib/courses'
import { fetchContentItem } from '@/lib/content-queries'
import { BodyClass } from '@/components/app/BodyClass'
import { ContentPlayer } from '@/components/courses/ContentPlayer'
import { MarkCompleteButton } from '@/components/courses/MarkCompleteButton'

type RouteParams = { version: string; n: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { version, n } = await params
  return { title: `BSS ${version} — Segment ${n}` }
}

export default async function BssSegmentPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { version, n: nStr } = await params
  const n = parseInt(nStr, 10)

  if (!isValidBssVersion(version) || !Number.isFinite(n) || n < 1) {
    notFound()
  }

  const versionMeta = BSS_VERSIONS.find((v) => v.slug === version)!

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const item = await fetchContentItem(supabase, 'bss', n, version as BssVersion)
  if (!item) notFound()

  const { data: progress } = await supabase
    .from('content_progress')
    .select('id')
    .eq('user_id', user.id)
    .eq('content_item_id', item.id)
    .maybeSingle()

  const initialDone = !!progress

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main courses-main--narrow">
        <Link href={`/courses/bss/${version}`} className="lesson-back-btn">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="15"
            height="15"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {versionMeta.label}
        </Link>

        <div className="lesson-header">
          <p className="section-eyebrow">BSS — {versionMeta.label}</p>
          <h1>{item.title ?? `Segment ${item.sequence_num}`}</h1>
        </div>

        <div className="lesson-body">
          <ContentPlayer
            mediaUrl={item.media_url}
            mediaKind="video"
            title={item.title ?? `BSS ${version} Segment ${item.sequence_num}`}
          />
          {item.description && (
            <p className="content-description">{item.description}</p>
          )}
          <div className="lesson-complete-section">
            <MarkCompleteButton
              userId={user.id}
              contentItemId={item.id}
              initialDone={initialDone}
            />
          </div>
        </div>
      </main>
    </>
  )
}
