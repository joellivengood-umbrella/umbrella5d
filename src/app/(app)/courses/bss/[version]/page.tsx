import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  BSS_VERSIONS,
  isValidBssVersion,
  type BssVersion,
} from '@/lib/courses'
import { fetchContentItems, fetchCompletedItemIds } from '@/lib/content-queries'
import { BodyClass } from '@/components/app/BodyClass'
import { ContentItemTile } from '@/components/courses/ContentItemTile'

type RouteParams = { version: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { version } = await params
  return { title: `BSS ${version}` }
}

export default async function BssVersionPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { version } = await params
  if (!isValidBssVersion(version)) notFound()

  const versionMeta = BSS_VERSIONS.find((v) => v.slug === version)!

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [items, completed] = await Promise.all([
    fetchContentItems(supabase, 'bss', version as BssVersion),
    fetchCompletedItemIds(supabase, user.id),
  ])

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main course-theme-bss">
        <Link href="/courses/bss" className="lesson-back-btn">
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
          BSS versions
        </Link>

        <div className="courses-header">
          <p className="section-eyebrow">Business Success Seminar</p>
          <h1>{versionMeta.label}</h1>
          <p className="courses-header__blurb">
            {items.length} segment{items.length === 1 ? '' : 's'}. Work through
            them in order, or jump to any segment.
          </p>
        </div>

        <div className="content-item-list">
          {items.map((item) => (
            <ContentItemTile
              key={item.id}
              href={`/courses/bss/${version}/${item.sequence_num}`}
              number={item.sequence_num}
              title={item.title ?? `Segment ${item.sequence_num}`}
              durationMins={item.duration_mins}
              done={completed.has(item.id)}
            />
          ))}
        </div>
      </main>
    </>
  )
}
