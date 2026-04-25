import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  isValidCourseSlug,
  getCourseMeta,
  type CourseSlug,
} from '@/lib/courses'
import { BodyClass } from '@/components/app/BodyClass'
import { ContentItemForm, type ContentItemDraft } from '../ContentItemForm'

type RouteParams = { slug: string; id: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { slug } = await params
  if (!isValidCourseSlug(slug)) return { title: 'Admin' }
  return { title: `Edit · ${getCourseMeta(slug as CourseSlug).shortTitle}` }
}

export default async function AdminEditItemPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { slug, id } = await params
  if (!isValidCourseSlug(slug)) notFound()
  const courseSlug = slug as CourseSlug
  const meta = getCourseMeta(courseSlug)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_items')
    .select(
      'id, type, sequence_num, title, description, media_url, duration_mins, is_published, metadata'
    )
    .eq('id', id)
    .eq('type', courseSlug)
    .maybeSingle()

  if (error || !data) notFound()

  const draft: ContentItemDraft = {
    id: data.id,
    type: courseSlug,
    sequence_num: data.sequence_num,
    title: data.title,
    description: data.description,
    media_url: data.media_url,
    duration_mins: data.duration_mins,
    is_published: data.is_published,
    metadata: (data.metadata as Record<string, unknown> | null) ?? null,
  }

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className={`courses-main course-theme-${courseSlug}`}>
        <Link href={`/admin/${courseSlug}`} className="lesson-back-btn">
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
          Back to {meta.shortTitle} list
        </Link>

        <div className="courses-header">
          <p className="section-eyebrow">{meta.shortTitle} · admin</p>
          <h1>
            {draft.title || `Item #${draft.sequence_num ?? '—'}`}
          </h1>
          <p className="courses-header__blurb">
            Editing existing item. Changes save to Supabase immediately.
          </p>
        </div>

        <section className="settings-section">
          <ContentItemForm courseSlug={courseSlug} initial={draft} />
        </section>
      </main>
    </>
  )
}

export const dynamic = 'force-dynamic'
