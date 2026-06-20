import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'
import { fetchUserPartner, fetchPartnerOrgs } from '@/lib/org-queries'
import { PartnerProfileEditor } from './PartnerProfileEditor'
import { PartnerInviteCode } from './PartnerInviteCode'

export const metadata = { title: 'Partner' }
export const dynamic = 'force-dynamic'

/**
 * The Partner home. Gated to partner accounts (a user who owns a partner);
 * 404s anyone else. Shows the partner's editable profile + invite code, and
 * a read-only list of the organizations they own. Broadcasting to those orgs
 * arrives with the feed.
 */
export default async function PartnerPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const partner = await fetchUserPartner(supabase, user.id)
  if (!partner) notFound()

  const orgs = await fetchPartnerOrgs(supabase)

  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="partner-main">
        <div className="courses-header partner-header">
          <div className="partner-header__titles">
            <p className="section-eyebrow">Partner</p>
            <h1>{partner.name}</h1>
          </div>
          <PartnerInviteCode inviteCode={partner.inviteCode} />
        </div>

        <PartnerProfileEditor partner={partner} userId={user.id} />

        <section className="settings-section partner-orgs">
          <header className="settings-section__header">
            <h2>Your organizations</h2>
            <p>
              {orgs.length === 0
                ? 'No organizations have joined under your code yet.'
                : `${orgs.length} organization${orgs.length === 1 ? '' : 's'} under your partnership.`}
            </p>
          </header>

          {orgs.length > 0 && (
            <ul className="partner-orgs__list">
              {orgs.map((o) => (
                <li key={o.id} className="partner-orgs__row">
                  <span className="partner-orgs__name">{o.name}</span>
                  <span className="partner-orgs__since">
                    Joined{' '}
                    {new Date(o.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  )
}
