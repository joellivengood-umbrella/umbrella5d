import Link from 'next/link'
import { notFound } from 'next/navigation'
import { courseThemeVars } from '@/lib/courses'
import { createClient } from '@/lib/supabase/server'
import { fetchCourse } from '@/lib/course-queries'
import { fetchMachinePartsList } from '@/lib/machine-queries'
import { BodyClass } from '@/components/app/BodyClass'
import { ContentItemForm } from '../ContentItemForm'

type RouteParams = { slug: string }

export const metadata = { title: 'New item · Admin' }

export default async function AdminNewItemPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const course = await fetchCourse(supabase, slug)
  if (!course) notFound()

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
          <h1>New item</h1>
        </div>

        <section className="settings-section">
          <ContentItemForm
            courseSlug={course.slug}
            parts={parts}
            initial={{
              id: null,
              type: course.slug,
              sequence_num: null,
              title: null,
              description: null,
              media_url: null,
              duration_mins: null,
              is_published: false,
              metadata: null,
            }}
          />
        </section>
      </main>
    </>
  )
}
