'use client'

import { useState } from 'react'

/**
 * Disclosure wrapper for the personal profile settings. On a partner account
 * the Settings page leads with the Partner profile, so the personal profile
 * (name / role / avatar) is collapsed behind this toggle to keep the page
 * focused on partner branding. Children are the real <ProfileSection> card,
 * passed in from the (server) Settings page and revealed on demand.
 */
export function PersonalProfileReveal({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="personal-reveal">
      <button
        type="button"
        className="personal-reveal__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="personal-reveal__main">
          <svg
            className="personal-reveal__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="personal-reveal__text">
            <span className="personal-reveal__label">
              Personal Profile Settings
            </span>
            <span className="personal-reveal__sub">
              Your name, role, and avatar
            </span>
          </span>
        </span>
        <svg
          className={`personal-reveal__chev${open ? ' is-open' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && <div className="personal-reveal__body">{children}</div>}
    </div>
  )
}
