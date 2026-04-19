import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCourseMeta } from '@/lib/courses'
import { fetchContentItems, fetchCompletedItemIds } from '@/lib/content-queries'
import { BodyClass } from '@/components/app/BodyClass'
import { ContentItemTile } from '@/components/courses/ContentItemTile'

export const metadata = { title: 'Employee Opportunity Seminars' }

export default async function EosIndexPage() {
  const meta = getCourseMeta('eos')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [items, completed] = await Promise.all([
    fetchContentItems(supabase, 'eos'),
    fetchCompletedItemIds(supabase, user.id),
  ])

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main">
        <Link href="/courses" className="lesson-back-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          All Courses
        </Link>

        <div className="courses-header">
          <p className="section-eyebrow">{meta.shortTitle}</p>
          <h1>{meta.title}</h1>
          <p className="courses-header__blurb">{meta.blurb}</p>
        </div>

        <div className="content-item-list">
          {items.map((item) => (
            <ContentItemTile
              key={item.id}
              href={`/courses/eos/${item.sequence_num}`}
              number={item.sequence_num}
              title={item.title ?? `EOS ${item.sequence_num}`}
              durationMins={item.duration_mins}
              done={completed.has(item.id)}
            />
          ))}
        </div>
      </main>
    </>
  )
}
