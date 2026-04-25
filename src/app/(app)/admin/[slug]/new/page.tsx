import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  isValidCourseSlug,
  getCourseMeta,
  type CourseSlug,
} from '@/lib/courses'
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
  if (!isValidCourseSlug(slug)) notFound()
  const courseSlug = slug as CourseSlug
  const meta = getCourseMeta(courseSlug)

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
          <h1>New item</h1>
        </div>

        <section className="settings-section">
          <ContentItemForm
            courseSlug={courseSlug}
            initial={{
              id: null,
              type: courseSlug,
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
