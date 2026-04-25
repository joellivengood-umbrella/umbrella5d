import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { COURSES } from '@/lib/courses'
import { fetchTotalsByType } from '@/lib/content-queries'
import { BodyClass } from '@/components/app/BodyClass'

export const metadata = { title: 'Admin' }

export default async function AdminIndexPage() {
  const supabase = await createClient()
  const totals = await fetchTotalsByType(supabase)

  // Also count unpublished rows so admins can see "in progress" totals.
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
            Add, edit, and publish content items across every course. Choose a
            course to manage its items.
          </p>
        </div>

        <div className="admin-course-grid">
          {COURSES.map((c) => (
            <Link
              key={c.slug}
              href={`/admin/${c.slug}`}
              className={`admin-course-card course-theme-${c.slug}`}
            >
              <p className="section-eyebrow">{c.shortTitle}</p>
              <h2>{c.title}</h2>
              <div className="admin-course-card__stats">
                <span>
                  <strong>{totals[c.slug]}</strong> published
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
