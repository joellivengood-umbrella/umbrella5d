import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  fetchMachineLessonBySequence,
  fetchBlockChecks,
  fetchActivityAnswers,
  partOrdinal,
} from '@/lib/machine-queries'
import { BodyClass } from '@/components/app/BodyClass'
import { ContentPlayer } from '@/components/courses/ContentPlayer'
import { MarkCompleteButton } from '@/components/courses/MarkCompleteButton'
import { MachineLessonView } from '@/components/courses/machine/MachineLessonView'

type RouteParams = { n: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { n } = await params
  return { title: `5D Machine — Lesson ${n}` }
}

export default async function MachineItemPage({
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

  const lesson = await fetchMachineLessonBySequence(supabase, n)
  if (!lesson) notFound()

  const hasBlocks = lesson.blocks.length > 0
  const address =
    lesson.partNumber != null && lesson.lessonNumber != null
      ? `${lesson.partNumber}.${lesson.lessonNumber}`
      : null

  // Per-user state (rich lessons only).
  const blockIds = lesson.blocks.map((b) => b.id)
  const [checkedIds, answers, progress] = await Promise.all([
    hasBlocks
      ? fetchBlockChecks(supabase, user.id, blockIds)
      : Promise.resolve(new Set<string>()),
    hasBlocks
      ? fetchActivityAnswers(supabase, user.id, blockIds)
      : Promise.resolve([]),
    supabase
      .from('content_progress')
      .select('id')
      .eq('user_id', user.id)
      .eq('content_item_id', lesson.id)
      .maybeSingle(),
  ])
  const initiallyComplete = !!progress.data

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main courses-main--narrow course-theme-machine">
        <Link href="/courses/machine" className="lesson-back-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          The 5D Machine
        </Link>

        <div className="lesson-header">
          <p className="section-eyebrow">
            {lesson.partNumber != null
              ? `Part ${partOrdinal(lesson.partNumber)}${lesson.partTitle ? ` · ${lesson.partTitle}` : ''}`
              : '5D Machine'}
          </p>
          <h1>
            {address ? <span className="lesson-address">{address}</span> : null}
            {lesson.title ?? `Lesson ${lesson.sequenceNum}`}
          </h1>
          {!lesson.isPublished && (
            <span className="lesson-draft-badge">
              Draft preview — only admins can see this
            </span>
          )}
        </div>

        {hasBlocks ? (
          <MachineLessonView
            userId={user.id}
            lessonId={lesson.id}
            partNumber={lesson.partNumber}
            lessonNumber={lesson.lessonNumber}
            sectionTitles={lesson.sectionTitles}
            blocks={lesson.blocks}
            initialCheckedIds={[...checkedIds]}
            initialAnswers={answers}
            initiallyComplete={initiallyComplete}
          />
        ) : (
          // Legacy / not-yet-authored machine lesson: the original simple
          // view (single media + description + one Mark Complete button).
          <div className="lesson-body">
            <ContentPlayer
              mediaUrl={lesson.mediaUrl}
              mediaKind="video"
              title={lesson.title ?? `5D Machine Lesson ${lesson.sequenceNum}`}
            />
            {lesson.description && (
              <p className="content-description">{lesson.description}</p>
            )}
            <div className="lesson-complete-section">
              <MarkCompleteButton
                userId={user.id}
                contentItemId={lesson.id}
                initialDone={initiallyComplete}
              />
            </div>
          </div>
        )}
      </main>
    </>
  )
}
