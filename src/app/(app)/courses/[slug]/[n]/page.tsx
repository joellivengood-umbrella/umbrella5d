import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { courseThemeVars } from '@/lib/courses'
import { fetchCourse } from '@/lib/course-queries'
import { fetchContentItem } from '@/lib/content-queries'
import { BodyClass } from '@/components/app/BodyClass'
import { ContentPlayer } from '@/components/courses/ContentPlayer'
import { MarkCompleteButton } from '@/components/courses/MarkCompleteButton'

/**
 * Generic lesson player for a flat course. Mirrors the EOS item page but
 * resolves the course from the table — title, theme, and the video/audio
 * player kind all come from the course row. Serves admin-created courses;
 * the built-in four use their bespoke folders, which shadow this route.
 */

type RouteParams = { slug: string; n: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { slug, n } = await params
  const supabase = await createClient()
  const course = await fetchCourse(supabase, slug)
  return { title: course ? `${course.shortTitle} ${n}` : 'Lesson' }
}

export default async function CourseItemPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { slug, n: nStr } = await params
  const n = parseInt(nStr, 10)
  if (!Number.isFinite(n) || n < 1) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const course = await fetchCourse(supabase, slug)
  if (!course) notFound()

  const item = await fetchContentItem(supabase, course.slug, n)
  if (!item) notFound()

  const { data: progress } = await supabase
    .from('content_progress')
    .select('id')
    .eq('user_id', user.id)
    .eq('content_item_id', item.id)
    .maybeSingle()

  const fallbackTitle = `${course.shortTitle} ${item.sequence_num}`

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main
        className="courses-main courses-main--narrow"
        style={courseThemeVars(course.theme)}
      >
        <Link href={`/courses/${course.slug}`} className="lesson-back-btn">
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
          {course.title}
        </Link>

        <div className="lesson-header">
          <p className="section-eyebrow">{course.shortTitle}</p>
          <h1>{item.title ?? fallbackTitle}</h1>
        </div>

        <div className="lesson-body">
          <ContentPlayer
            mediaUrl={item.media_url}
            mediaKind={course.mediaKind}
            title={item.title ?? fallbackTitle}
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
