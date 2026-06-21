import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { courseThemeVars } from '@/lib/courses'
import { fetchCourses } from '@/lib/course-queries'
import { BodyClass } from '@/components/app/BodyClass'
import { CreateCoursePanel } from './CreateCoursePanel'

export const metadata = { title: 'Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminIndexPage() {
  const supabase = await createClient()
  const [courses, { data: countRows, error: countErr }] = await Promise.all([
    fetchCourses(supabase),
    supabase.rpc('content_counts_by_course'),
  ])

  // Per-course published + draft counts from one DB-side grouped query
  // instead of scanning every content_items row. These are non-critical
  // numbers, so degrade to 0 rather than failing the whole admin panel.
  if (countErr) console.error('admin content counts error', countErr)
  const published: Record<string, number> = {}
  const drafts: Record<string, number> = {}
  for (const row of countRows ?? []) {
    const r = row as {
      course_slug: string
      published_count: number
      draft_count: number
    }
    published[r.course_slug] = r.published_count
    drafts[r.course_slug] = r.draft_count
  }

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main">
        <div className="courses-header">
          <p className="section-eyebrow">Admin</p>
          <h1>Content library</h1>
          <p className="courses-header__blurb">
            Add, edit, and publish content across every course — or create a new
            course. Choose a course to manage its lessons.
          </p>
          <div className="admin-quicklinks">
            <Link href="/admin/partners" className="btn btn--secondary btn--sm">
              Partner bumpers →
            </Link>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <CreateCoursePanel />
        </div>

        <div className="admin-course-grid">
          {courses.map((c) => (
            <Link
              key={c.slug}
              href={`/admin/${c.slug}`}
              className="admin-course-card"
              style={courseThemeVars(c.theme)}
            >
              <p className="section-eyebrow">
                {c.shortTitle}
                {!c.isPublished && (
                  <span className="admin-pill admin-pill--draft"> Draft</span>
                )}
              </p>
              <h2>{c.title}</h2>
              <div className="admin-course-card__stats">
                <span>
                  <strong>{published[c.slug] ?? 0}</strong> published
                </span>
                <span>
                  <strong>{drafts[c.slug] ?? 0}</strong> drafts
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  )
}
