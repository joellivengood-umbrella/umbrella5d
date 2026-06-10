import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchMachinePartsList } from '@/lib/machine-queries'
import { BodyClass } from '@/components/app/BodyClass'
import { MachinePartsManager } from './MachinePartsManager'

type RouteParams = { slug: string }

export const metadata = { title: 'Parts · 5D Machine admin' }

export default async function MachinePartsPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { slug } = await params
  // Parts only exist for the 5D Machine course.
  if (slug !== 'machine') notFound()

  const supabase = await createClient()
  const parts = await fetchMachinePartsList(supabase)

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main courses-main--narrow course-theme-machine">
        <Link href="/admin/machine" className="lesson-back-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to 5D Machine list
        </Link>

        <div className="courses-header">
          <p className="section-eyebrow">5D Machine · admin</p>
          <h1>Parts</h1>
          <p className="courses-header__blurb">
            The Parts that group your lessons (Part One, Part Two…). Set their
            order and publish them here. Each lesson is slotted into a Part on
            its own settings page.
          </p>
        </div>

        <MachinePartsManager initialParts={parts} />
      </main>
    </>
  )
}

export const dynamic = 'force-dynamic'
