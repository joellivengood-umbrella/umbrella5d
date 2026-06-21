import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'
import { PartnerBumperManager } from './PartnerBumperManager'

export const metadata = { title: 'Partner bumpers' }
export const dynamic = 'force-dynamic'

type PartnerRow = {
  id: string
  name: string
  avatar_url: string | null
  bumper_url: string | null
}

/**
 * Admin: attach an audio bumper to each partner. Gated by the /admin layout
 * (platform admins only). Admins can SELECT every partner via RLS, so the
 * list is a plain query; writes go through the set_partner_bumper RPC inside
 * <PartnerBumperManager>.
 */
export default async function AdminPartnersPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('partners')
    .select('id, name, avatar_url, bumper_url')
    .order('name', { ascending: true })

  if (error) console.error('admin partners list error', error)
  const partners = (data ?? []) as PartnerRow[]

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main">
        <div className="courses-header">
          <Link href="/admin" className="lesson-back-btn">
            ← Admin
          </Link>
          <p className="section-eyebrow">Admin</p>
          <h1>Partner bumpers</h1>
          <p className="courses-header__blurb">
            Attach a short &ldquo;Brought to you by&hellip;&rdquo; audio bumper
            to a partner. It plays before content audio for every member under
            that partner — except 5D Machine.
          </p>
        </div>

        {partners.length === 0 ? (
          <p className="admin-partners__empty">
            No partners yet. Partners are created by the promote script.
          </p>
        ) : (
          <ul className="admin-partners">
            {partners.map((p) => {
              const initial = p.name.trim().charAt(0).toUpperCase() || 'P'
              return (
                <li key={p.id} className="admin-partner-card">
                  <div className="admin-partner-card__id">
                    {p.avatar_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        className="admin-partner-card__logo"
                        src={p.avatar_url}
                        alt=""
                      />
                    ) : (
                      <span
                        className="admin-partner-card__logo admin-partner-card__logo--empty"
                        aria-hidden="true"
                      >
                        {initial}
                      </span>
                    )}
                    <span className="admin-partner-card__name">{p.name}</span>
                  </div>
                  <PartnerBumperManager
                    partnerId={p.id}
                    initialBumperUrl={p.bumper_url}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </>
  )
}
