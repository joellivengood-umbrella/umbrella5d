'use client'

import { useState } from 'react'

/**
 * The partner invite code, revealed on demand. Lives in the page header to
 * the right of the partner name. Collapsed by default — "Show invite code"
 * reveals it with a Copy button — so the code isn't shoulder-surfed by
 * default and doesn't dominate the header.
 */
export function PartnerInviteCode({ inviteCode }: { inviteCode: string }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setCopyError(false)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopyError(true)
    }
  }

  return (
    <div className="partner-invite">
      <button
        type="button"
        className="btn btn--secondary btn--sm partner-invite__toggle"
        onClick={() => setRevealed((r) => !r)}
        aria-expanded={revealed}
      >
        {revealed ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
        {revealed ? 'Hide invite code' : 'Show invite code'}
      </button>

      {revealed && (
        <div className="partner-invite__panel">
          <span className="partner-invite__label">Invite code</span>
          <div className="partner-invite__row">
            <code className="partner-invite__value">{inviteCode}</code>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={copyCode}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="partner-invite__hint">
            Share with organizations to bring them under your partnership. Keep
            it private — anyone who uses it becomes the manager of a new
            organization owned by you.
          </p>
          {copyError && (
            <p className="partner-invite__hint" role="alert">
              Couldn&rsquo;t copy automatically — select the code and copy it
              manually.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
