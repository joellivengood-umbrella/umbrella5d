import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'
import {
  fetchUserPartner,
  fetchPartnerOrgs,
  fetchPartnerImpact,
} from '@/lib/org-queries'
import { PartnerProfileEditor } from './PartnerProfileEditor'
import { PartnerInviteCode } from './PartnerInviteCode'
import { PartnerMemberPreview } from './PartnerMemberPreview'

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

  const [orgs, impact] = await Promise.all([
    fetchPartnerOrgs(supabase),
    fetchPartnerImpact(supabase),
  ])

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

        <section className="settings-section partner-impact">
          <header className="settings-section__header">
            <h2>Your reach</h2>
            <p>The impact of your partnership so far.</p>
          </header>
          <div className="partner-impact__grid">
            <div className="partner-impact__stat">
              <span className="partner-impact__num">
                {impact.orgCount.toLocaleString()}
              </span>
              <span className="partner-impact__label">
                {impact.orgCount === 1 ? 'Organization' : 'Organizations'}
              </span>
            </div>
            <div className="partner-impact__stat">
              <span className="partner-impact__num">
                {impact.memberCount.toLocaleString()}
              </span>
              <span className="partner-impact__label">
                {impact.memberCount === 1 ? 'Member' : 'Members'}
              </span>
            </div>
            <div className="partner-impact__stat">
              <span className="partner-impact__num">
                {impact.completionCount.toLocaleString()}
              </span>
              <span className="partner-impact__label">Lessons completed</span>
            </div>
          </div>
          {impact.memberCount > 0 && (
            <p className="partner-impact__headline">
              {impact.memberCount.toLocaleString()}{' '}
              {impact.memberCount === 1 ? 'person is' : 'people are'} learning
              because of you.
            </p>
          )}
        </section>

        <PartnerProfileEditor partner={partner} userId={user.id} />

        <section className="settings-section">
          <header className="settings-section__header">
            <h2>What your members see</h2>
            <p>Your brand appears across every member&rsquo;s account.</p>
          </header>
          <PartnerMemberPreview partner={partner} />
        </section>

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
