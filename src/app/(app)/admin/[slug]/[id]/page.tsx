import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { courseThemeVars } from '@/lib/courses'
import { fetchCourse } from '@/lib/course-queries'
import { fetchMachinePartsList } from '@/lib/machine-queries'
import { BodyClass } from '@/components/app/BodyClass'
import { ContentItemForm, type ContentItemDraft } from '../ContentItemForm'

type RouteParams = { slug: string; id: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const course = await fetchCourse(supabase, slug)
  return { title: course ? `Edit · ${course.shortTitle}` : 'Admin' }
}

export default async function AdminEditItemPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { slug, id } = await params
  const supabase = await createClient()
  const course = await fetchCourse(supabase, slug)
  if (!course) notFound()

  const { data, error } = await supabase
    .from('content_items')
    .select(
      'id, type, sequence_num, title, description, media_url, duration_mins, is_published, metadata, part_id, part_sort_index'
    )
    .eq('id', id)
    .eq('type', course.slug)
    .maybeSingle()

  if (error || !data) notFound()

  const draft: ContentItemDraft = {
    id: data.id,
    type: course.slug,
    sequence_num: data.sequence_num,
    title: data.title,
    description: data.description,
    media_url: data.media_url,
    duration_mins: data.duration_mins,
    is_published: data.is_published,
    metadata: (data.metadata as Record<string, unknown> | null) ?? null,
    part_id: (data.part_id as string | null) ?? null,
    part_sort_index: (data.part_sort_index as number | null) ?? null,
  }

  const parts =
    course.slug === 'machine'
      ? (await fetchMachinePartsList(supabase)).map((p) => ({
          id: p.id,
          sortIndex: p.sortIndex,
          title: p.title,
        }))
      : []

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main" style={courseThemeVars(course.theme)}>
        <Link href={`/admin/${course.slug}`} className="lesson-back-btn">
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
          Back to {course.shortTitle} list
        </Link>

        <div className="courses-header">
          <p className="section-eyebrow">{course.shortTitle} · admin</p>
          <h1>{draft.title || `Item #${draft.sequence_num ?? '—'}`}</h1>
          <p className="courses-header__blurb">
            Editing existing item. Changes save to Supabase immediately.
          </p>
        </div>

        {course.slug === 'machine' && (
          <Link href={`/admin/machine/${draft.id}/blocks`} className="lbe-cta">
            <div>
              <strong>Edit lesson content</strong>
              <span>
                Build the body and activity — text, media, and the checkable
                steps and questions.
              </span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        )}

        <section className="settings-section">
          <ContentItemForm
            courseSlug={course.slug}
            initial={draft}
            parts={parts}
          />
        </section>
      </main>
    </>
  )
}

export const dynamic = 'force-dynamic'
