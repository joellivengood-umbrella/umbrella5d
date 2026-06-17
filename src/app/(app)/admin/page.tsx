import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { courseThemeVars } from '@/lib/courses'
import { fetchCourses } from '@/lib/course-queries'
import { fetchTotalsByType } from '@/lib/content-queries'
import { BodyClass } from '@/components/app/BodyClass'
import { CreateCoursePanel } from './CreateCoursePanel'

export const metadata = { title: 'Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminIndexPage() {
  const supabase = await createClient()
  const [courses, totals] = await Promise.all([
    fetchCourses(supabase),
    fetchTotalsByType(supabase),
  ])

  // Count unpublished rows per course so admins see "in progress" totals.
  const { data: allRows } = await supabase
    .from('content_items')
    .select('type, is_published')
  const drafts: Record<string, number> = {}
  for (const r of allRows ?? []) {
    if (!r.is_published) {
      drafts[r.type] = (drafts[r.type] ?? 0) + 1
    }
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
                  <strong>{totals[c.slug] ?? 0}</strong> published
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
