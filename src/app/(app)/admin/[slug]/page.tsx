import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  isValidCourseSlug,
  getCourseMeta,
  type CourseSlug,
} from '@/lib/courses'
import { BodyClass } from '@/components/app/BodyClass'

type RouteParams = { slug: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { slug } = await params
  if (!isValidCourseSlug(slug)) return { title: 'Admin' }
  return { title: `Admin · ${getCourseMeta(slug as CourseSlug).shortTitle}` }
}

type Row = {
  id: string
  sequence_num: number
  title: string | null
  duration_mins: number | null
  media_url: string | null
  is_published: boolean
  metadata: Record<string, unknown> | null
}

export default async function AdminCoursePage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { slug } = await params
  if (!isValidCourseSlug(slug)) notFound()
  const courseSlug = slug as CourseSlug
  const meta = getCourseMeta(courseSlug)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_items')
    .select(
      'id, sequence_num, title, duration_mins, media_url, is_published, metadata'
    )
    .eq('type', courseSlug)
    .order('sequence_num', { ascending: true })

  if (error) console.error('admin list error', error)
  const rows = (data ?? []) as Row[]

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className={`courses-main course-theme-${courseSlug}`}>
        <Link href="/admin" className="lesson-back-btn">
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
          All admin
        </Link>

        <div className="courses-header">
          <p className="section-eyebrow">{meta.shortTitle} · admin</p>
          <h1>{meta.title}</h1>
          <p className="courses-header__blurb">
            {rows.length} item{rows.length === 1 ? '' : 's'} total.
          </p>
        </div>

        <div className="admin-toolbar">
          <Link href={`/admin/${courseSlug}/new`} className="btn btn--primary">
            + New item
          </Link>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Title</th>
                {courseSlug === 'bss' && <th>Version</th>}
                <th style={{ width: 90 }}>Duration</th>
                <th style={{ width: 90 }}>Media</th>
                <th style={{ width: 110 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={courseSlug === 'bss' ? 6 : 5}>
                    <div className="admin-empty">
                      No items yet. Click <strong>+ New item</strong> to add the
                      first one.
                    </div>
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const version =
                  (r.metadata && typeof r.metadata === 'object'
                    ? (r.metadata as Record<string, unknown>).version
                    : null) ?? null
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/admin/${courseSlug}/${r.id}`}>
                        {r.sequence_num}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/admin/${courseSlug}/${r.id}`}>
                        {r.title || (
                          <span className="admin-muted">(untitled)</span>
                        )}
                      </Link>
                    </td>
                    {courseSlug === 'bss' && (
                      <td>{(version as string) ?? '—'}</td>
                    )}
                    <td>
                      {r.duration_mins ? `${r.duration_mins} min` : '—'}
                    </td>
                    <td>
                      {r.media_url ? (
                        <span className="admin-pill admin-pill--ok">URL</span>
                      ) : (
                        <span className="admin-pill admin-pill--muted">
                          none
                        </span>
                      )}
                    </td>
                    <td>
                      {r.is_published ? (
                        <span className="admin-pill admin-pill--ok">
                          Published
                        </span>
                      ) : (
                        <span className="admin-pill admin-pill--draft">
                          Draft
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>
    </>
  )
}

// Force the admin list to render at request time so newly-created/edited
// items show up without manual revalidation.
export const dynamic = 'force-dynamic'
