import Link from 'next/link'
import { BodyClass } from '@/components/app/BodyClass'
import { MediaOrganizer } from './MediaOrganizer'

export const metadata = { title: 'Media files' }
export const dynamic = 'force-dynamic'

/**
 * Admin: tidy the lesson-media Storage bucket (gated by the /admin layout).
 * New uploads are already filed by course and lesson; this sorts older files
 * the same way and clears out ones nothing uses.
 */
export default function AdminMediaPage() {
  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main">
        <Link href="/admin" className="lesson-back-btn">
          ← Admin
        </Link>
        <div className="courses-header">
          <p className="section-eyebrow">Admin</p>
          <h1>Media files</h1>
          <p className="courses-header__blurb">
            Uploads are filed automatically by course and lesson. This tool
            sorts any older files into the same folders (updating every link
            to them) and deletes files no lesson, 5D Machine block, or partner
            bumper uses. Scan first to see exactly what will change.
          </p>
        </div>
        <section className="settings-section">
          <MediaOrganizer />
        </section>
      </main>
    </>
  )
}
