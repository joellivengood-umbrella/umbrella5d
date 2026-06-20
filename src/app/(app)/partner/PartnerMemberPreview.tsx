import type { Partner } from '@/lib/org-queries'

/**
 * A truthful preview of how the partner's brand appears inside a member's
 * account: the sidebar co-brand strip (bottom-left of every page) and the
 * "Your Partner" card on the dashboard. Decorative — the real surfaces live
 * in members' accounts — so the frame is aria-hidden.
 */
export function PartnerMemberPreview({ partner }: { partner: Partner }) {
  const initial = partner.name.trim().charAt(0).toUpperCase() || 'P'

  return (
    <div className="partner-preview__frame" aria-hidden="true">

      {/* Left: sidebar stub with co-brand pinned to bottom */}
      <div className="partner-preview__sidebar-stub">
        <p className="partner-preview__section-label">Sidebar</p>
        <div className="sidebar-cobrand">
          <span className="sidebar-cobrand__label">Provided by</span>
          <div className="sidebar-cobrand__logobox">
            {partner.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img className="sidebar-cobrand__logo" src={partner.avatarUrl} alt="" />
            ) : (
              <div className="sidebar-cobrand__logo sidebar-cobrand__logo--empty">
                {initial}
              </div>
            )}
          </div>
          <span className="sidebar-cobrand__name">{partner.name}</span>
        </div>
      </div>

      {/* Right: "Your Partner" card on the member dashboard */}
      <div className="partner-preview__section">
        <p className="partner-preview__section-label">Dashboard</p>
        <section className="dash-partner">
          {partner.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="dash-partner__logo" src={partner.avatarUrl} alt="" />
          ) : (
            <div className="dash-partner__logo dash-partner__logo--empty">
              {initial}
            </div>
          )}
          <div className="dash-partner__body">
            <p className="dash-partner__eyebrow">Your partner</p>
            <p className="dash-partner__name">{partner.name}</p>
            {partner.description && (
              <p className="dash-partner__desc">{partner.description}</p>
            )}
          </div>
        </section>
      </div>

    </div>
  )
}
