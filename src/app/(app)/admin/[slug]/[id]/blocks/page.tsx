import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type {
  LessonBlock,
  LessonSection,
  LessonBlockType,
  LessonBlockData,
} from '@/lib/courses'
import { BodyClass } from '@/components/app/BodyClass'
import { LessonBlockEditor } from './LessonBlockEditor'

type RouteParams = { slug: string; id: string }

export const metadata = { title: 'Edit lesson content' }

export default async function LessonBlocksPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { slug, id } = await params
  // The rich block editor is specific to 5D Machine lessons.
  if (slug !== 'machine') notFound()

  const supabase = await createClient()

  const { data: item, error } = await supabase
    .from('content_items')
    .select('id, type, sequence_num, title, is_published')
    .eq('id', id)
    .eq('type', 'machine')
    .maybeSingle()
  if (error || !item) notFound()

  const { data: blockRows, error: blocksErr } = await supabase
    .from('lesson_blocks')
    .select('id, lesson_id, section, sort_index, block_type, data, is_checkpoint')
    .eq('lesson_id', id)
    .order('sort_index', { ascending: true })
    .order('id', { ascending: true })
  if (blocksErr) notFound()

  const blocks: LessonBlock[] = (blockRows ?? []).map((b) => {
    const r = b as Record<string, unknown>
    return {
      id: r.id as string,
      lessonId: r.lesson_id as string,
      section: r.section as LessonSection,
      sortIndex: r.sort_index as number,
      blockType: r.block_type as LessonBlockType,
      data: (r.data as LessonBlockData) ?? {},
      isCheckpoint: r.is_checkpoint as boolean,
    }
  })

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main course-theme-machine">
        <Link href={`/admin/machine/${id}`} className="lesson-back-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to lesson settings
        </Link>

        <div className="courses-header">
          <p className="section-eyebrow">5D Machine · admin</p>
          <h1>{item.title || `Lesson #${item.sequence_num}`} — content</h1>
          <p className="courses-header__blurb">
            Build the lesson body and activity. Click <strong>Save changes</strong>{' '}
            when you&apos;re done.{' '}
            <Link href={`/courses/machine/${item.sequence_num}`} className="lbe-preview-link">
              Preview lesson ↗
            </Link>
          </p>
          {!item.is_published && (
            <span className="lesson-draft-badge">
              Draft — not visible to learners yet
            </span>
          )}
        </div>

        <LessonBlockEditor lessonId={item.id} initialBlocks={blocks} />
      </main>
    </>
  )
}

export const dynamic = 'force-dynamic'
