import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'
import { MODULE_COUNTS, MODULES } from '@/lib/curriculum'
import { LessonCompleteButton } from './LessonCompleteButton'

type RouteParams = { m: string; l: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { m, l } = await params
  return {
    title: `Module ${m} — Lesson ${l}`,
  }
}

export default async function LessonPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { m: mStr, l: lStr } = await params
  const m = parseInt(mStr, 10)
  const l = parseInt(lStr, 10)

  // Validate against curriculum
  const moduleMeta = MODULES.find((mod) => mod.n === m)
  const maxLesson = MODULE_COUNTS[m]
  if (!moduleMeta || !maxLesson || !Number.isFinite(l) || l < 1 || l > maxLesson) {
    notFound()
  }

  const lessonId = `${m}-${l}`

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null // Layout guards this; narrow type.

  const { data: progressRow } = await supabase
    .from('lesson_progress')
    .select('completed')
    .eq('user_id', user.id)
    .eq('lesson_id', lessonId)
    .maybeSingle()

  const initialDone = progressRow?.completed === true

  // Only Module 1 / Lesson 1 has real video content for now.
  const hasVideo = m === 1 && l === 1

  return (
    <>
      <BodyClass className="page-lesson" />
      <main className="lesson-main">
        <div className="lesson-header">
          <Link href="/dashboard" className="lesson-back-btn">
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
            Back to Dashboard
          </Link>
          <p className="section-eyebrow">
            Module {m} — {moduleMeta.title}
          </p>
          <h1>Lesson {l}</h1>
        </div>

        <div className="lesson-body">
          {hasVideo ? (
            <div className="lesson-video-wrap">
              <div className="video-wrapper">
                <iframe
                  src="https://player.vimeo.com/video/716223733"
                  title="Module 1 — Lesson 1 Video"
                  frameBorder={0}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          ) : (
            <div className="lesson-placeholder">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="48"
                height="48"
                aria-hidden="true"
              >
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              <p>Content coming soon.</p>
              <p className="lesson-placeholder-sub">
                Check back as the program rolls out.
              </p>
            </div>
          )}

          <div className="lesson-complete-section">
            <LessonCompleteButton
              userId={user.id}
              lessonId={lessonId}
              initialDone={initialDone}
            />
          </div>
        </div>
      </main>
    </>
  )
}
