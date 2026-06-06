import { BodyClass } from '@/components/app/BodyClass'

export const metadata = { title: 'Team' }

/**
 * Team management is shelved behind a "coming soon" placeholder for
 * now. The full implementation (roster, invite code, member progress,
 * per-member detail + assignments) still lives in this folder
 * (TeamRoster / TeamProgress / TeamInviteCode / MemberActions /
 * [memberId]) and in git history — when we turn the feature back on we
 * restore the data-driven page. This placeholder does no data fetching,
 * so it can't error.
 *
 * Header + sidebar come from the (app) layout automatically.
 */
export default function TeamPage() {
  return (
    <>
      <BodyClass className="page-dashboard" />
      <main className="courses-main settings-main">
        <div className="courses-header">
          <p className="section-eyebrow">Team</p>
          <h1>Team Management</h1>
        </div>

        <div className="coming-soon-panel">
          <div className="coming-soon-panel__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h2 className="coming-soon-panel__title">Coming soon</h2>
          <p className="coming-soon-panel__text">
            Team management — invites, your member roster, and team
            progress — is on the way. Check back shortly.
          </p>
        </div>
      </main>
    </>
  )
}
