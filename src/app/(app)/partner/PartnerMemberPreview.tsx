import type { Partner } from '@/lib/org-queries'

/**
 * A truthful preview of how the partner's brand appears inside a member's
 * account. Reuses the real member-facing co-brand pieces (.dash-sponsor and
 * .dash-partner) with the partner's own logo/name, inside a "screen" frame —
 * so the partner sees exactly what their members see. Decorative (the real
 * surfaces live in members' accounts), so the frame is aria-hidden.
 */
export function PartnerMemberPreview({ partner }: { partner: Partner }) {
  const initial = partner.name.trim().charAt(0).toUpperCase() || 'P'

  return (
    <div className="partner-preview__frame" aria-hidden="true">
      <div className="dash-sponsor">
        {partner.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className="dash-sponsor__logo" src={partner.avatarUrl} alt="" />
        ) : (
          <div className="dash-sponsor__logo dash-sponsor__logo--empty">
            {initial}
          </div>
        )}
        <p className="dash-sponsor__text">
          Your Umbrella Program is provided by <strong>{partner.name}</strong> —
          free.
        </p>
      </div>

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
  )
}
