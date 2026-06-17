import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { courseThemeVars } from '@/lib/courses'
import { fetchCourse } from '@/lib/course-queries'
import { fetchMachineAdminStructure } from '@/lib/machine-queries'
import { BodyClass } from '@/components/app/BodyClass'
import { MachineAdminList } from './MachineAdminList'
import { CourseSettingsForm } from './CourseSettingsForm'

type RouteParams = { slug: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const course = await fetchCourse(supabase, slug)
  return { title: course ? `Admin · ${course.shortTitle}` : 'Admin' }
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
  const supabase = await createClient()
  const course = await fetchCourse(supabase, slug)
  if (!course) notFound()

  const themeStyle = courseThemeVars(course.theme)

  // 5D Machine gets a structure-aware admin: Parts grouped with their
  // lessons, plus an "Unassigned" section. Other courses keep the flat
  // table below.
  if (course.slug === 'machine') {
    const { parts, unassigned } = await fetchMachineAdminStructure(supabase)
    const lessonCount =
      parts.reduce((n, p) => n + p.lessons.length, 0) + unassigned.length
    return (
      <>
        <BodyClass className="page-dashboard" />
        <main className="courses-main" style={themeStyle}>
          <Link href="/admin" className="lesson-back-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            All admin
          </Link>

          <div className="courses-header">
            <p className="section-eyebrow">{course.shortTitle} · admin</p>
            <h1>{course.title}</h1>
            <p className="courses-header__blurb">
              {parts.length} part{parts.length === 1 ? '' : 's'}, {lessonCount}{' '}
              lesson{lessonCount === 1 ? '' : 's'}.
            </p>
          </div>

          <MachineAdminList parts={parts} unassigned={unassigned} />

          <CourseSettingsForm course={course} />
        </main>
      </>
    )
  }

  const { data, error } = await supabase
    .from('content_items')
    .select(
      'id, sequence_num, title, duration_mins, media_url, is_published, metadata'
    )
    .eq('type', course.slug)
    .order('sequence_num', { ascending: true })

  if (error) console.error('admin list error', error)
  const rows = (data ?? []) as Row[]
  const hasVersions = course.template === 'versioned'

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main" style={themeStyle}>
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
          <p className="section-eyebrow">{course.shortTitle} · admin</p>
          <h1>{course.title}</h1>
          <p className="courses-header__blurb">
            {rows.length} item{rows.length === 1 ? '' : 's'} total.
          </p>
        </div>

        <div className="admin-toolbar">
          <Link href={`/admin/${course.slug}/new`} className="btn btn--primary">
            + New item
          </Link>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Title</th>
                {hasVersions && <th>Version</th>}
                <th style={{ width: 90 }}>Duration</th>
                <th style={{ width: 90 }}>Media</th>
                <th style={{ width: 110 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={hasVersions ? 6 : 5}>
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
                      <Link href={`/admin/${course.slug}/${r.id}`}>
                        {r.sequence_num}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/admin/${course.slug}/${r.id}`}>
                        {r.title || (
                          <span className="admin-muted">(untitled)</span>
                        )}
                      </Link>
                    </td>
                    {hasVersions && <td>{(version as string) ?? '—'}</td>}
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

        <CourseSettingsForm course={course} />
      </main>
    </>
  )
}

// Force the admin list to render at request time so newly-created/edited
// items show up without manual revalidation.
export const dynamic = 'force-dynamic'
