import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  isValidMbaVersion,
  MBA_VERSIONS,
  courseThemeVars,
  type MbaVersion,
} from '@/lib/courses'
import { fetchCourse } from '@/lib/course-queries'
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
  return { title: `MBA ${version} — Segment ${n}` }
}

export default async function MbaSegmentPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { version, n: nStr } = await params
  const n = parseInt(nStr, 10)

  if (!isValidMbaVersion(version) || !Number.isFinite(n) || n < 1) {
    notFound()
  }

  const versionMeta = MBA_VERSIONS.find((v) => v.slug === version)!

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const course = await fetchCourse(supabase, 'mba')
  if (!course) notFound()

  const item = await fetchContentItem(supabase, 'mba', n, version as MbaVersion)
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
      <main
        className="courses-main courses-main--narrow"
        style={courseThemeVars(course.theme)}
      >
        <Link href={`/courses/mba/${version}`} className="lesson-back-btn">
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
          <p className="section-eyebrow">
            {course.shortTitle} — {versionMeta.label}
          </p>
          <h1>{item.title ?? `Segment ${item.sequence_num}`}</h1>
        </div>

        <div className="lesson-body">
          <ContentPlayer
            mediaUrl={item.media_url}
            mediaKind={course.mediaKind}
            title={item.title ?? `MBA ${version} Segment ${item.sequence_num}`}
            bumperEligible={course.slug !== 'machine'}
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
