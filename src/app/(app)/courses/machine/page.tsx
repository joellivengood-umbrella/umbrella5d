import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { courseThemeVars } from '@/lib/courses'
import { fetchCourse } from '@/lib/course-queries'
import {
  fetchContentItems,
  fetchCompletedItemIds,
  fetchUserSettings,
} from '@/lib/content-queries'
import { fetchMachineLanding, partOrdinal } from '@/lib/machine-queries'
import { fetchMemberAssignments } from '@/lib/org-queries'
import { BodyClass } from '@/components/app/BodyClass'
import { ContentItemTile } from '@/components/courses/ContentItemTile'

export const metadata = { title: 'The 5D Machine' }

export default async function MachineIndexPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const course = await fetchCourse(supabase, 'machine')
  if (!course) notFound()

  const [parts, completed] = await Promise.all([
    fetchMachineLanding(supabase),
    fetchCompletedItemIds(supabase, user.id),
  ])
  const partsWithLessons = parts.filter((p) => p.lessons.length > 0)
  const hasParts = partsWithLessons.length > 0

  // Legacy flat list — only needed when no Parts have been authored yet.
  let fallbackBody: ReactNode = null
  if (!hasParts) {
    const [items, settings, assignments] = await Promise.all([
      fetchContentItems(supabase, 'machine'),
      fetchUserSettings(supabase, user.id),
      fetchMemberAssignments(supabase, user.id),
    ])
    const assignedItemIds = new Set(assignments.map((a) => a.contentItemId))
    const visibleItems = settings.showCompleted
      ? items
      : items.filter((i) => !completed.has(i.id))
    fallbackBody = (
      <div className="content-item-list">
        {visibleItems.map((item) => (
          <ContentItemTile
            key={item.id}
            href={`/courses/machine/${item.sequence_num}`}
            number={item.sequence_num}
            title={item.title ?? `Segment ${item.sequence_num}`}
            durationMins={item.duration_mins}
            done={completed.has(item.id)}
            assigned={assignedItemIds.has(item.id)}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main" style={courseThemeVars(course.theme)}>
        <Link href="/courses" className="lesson-back-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          All Courses
        </Link>

        <div className="courses-header">
          <p className="section-eyebrow">{course.shortTitle}</p>
          <h1>{course.title}</h1>
          {course.blurb && <p className="courses-header__blurb">{course.blurb}</p>}
        </div>

        {hasParts ? (
          <div className="m-parts">
            {partsWithLessons.map((part) => (
              <section key={part.id} className="m-part">
                <div className="m-part__head">
                  <p className="m-part__eyebrow">
                    Part {partOrdinal(part.sortIndex)}
                    {!part.isPublished && (
                      <span className="m-part__draft"> · Draft</span>
                    )}
                  </p>
                  <h2 className="m-part__title">{part.title}</h2>
                </div>
                <div className="m-part__grid">
                  {part.lessons.map((lesson) => {
                    const done = completed.has(lesson.id)
                    const num = `${part.sortIndex}.${lesson.partSortIndex}`
                    return (
                      <Link
                        key={lesson.id}
                        href={`/courses/machine/${lesson.sequenceNum}`}
                        title={lesson.title ?? `Lesson ${num}`}
                        aria-label={`Lesson ${num}${lesson.title ? `: ${lesson.title}` : ''}`}
                        className={
                          'm-box' +
                          (done ? ' is-done' : '') +
                          (!lesson.isPublished ? ' is-draft' : '')
                        }
                      >
                        {done ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="26" height="26" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <span className="m-box__num">{num}</span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          fallbackBody
        )}
      </main>
    </>
  )
}
