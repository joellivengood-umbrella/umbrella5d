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
              <svg className="partner-impact__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="7" width="20" height="15" rx="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                <line x1="12" y1="12" x2="12" y2="16"/>
                <line x1="10" y1="14" x2="14" y2="14"/>
              </svg>
              <span className="partner-impact__num">
                {impact.orgCount.toLocaleString()}
              </span>
              <span className="partner-impact__label">
                {impact.orgCount === 1 ? 'Organization' : 'Organizations'}
              </span>
            </div>
            <div className="partner-impact__stat">
              <svg className="partner-impact__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span className="partner-impact__num">
                {impact.memberCount.toLocaleString()}
              </span>
              <span className="partner-impact__label">
                {impact.memberCount === 1 ? 'Member' : 'Members'}
              </span>
            </div>
            <div className="partner-impact__stat">
              <svg className="partner-impact__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span className="partner-impact__num">
                {impact.completionCount.toLocaleString()}
              </span>
              <span className="partner-impact__label">Lessons completed</span>
            </div>
          </div>
          {impact.memberCount > 0 && (
            <p className="partner-impact__headline">
              <svg className="partner-impact__headline-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
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
