'use client'

import { useState } from 'react'

/**
 * Invite-code display + copy button for the Team page.
 *
 * Mirrors the same UX shipped in OrganizationSection on /settings.
 * The two surfaces will be reconciled (probably extracted into a
 * shared component) once the team page has settled.
 */
export function TeamInviteCode({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('Copy your invite code:', inviteCode)
    }
  }

  return (
    <section className="settings-section team-invite">
      <header className="settings-section__header">
        <h2>Invite new members</h2>
        <p>
          Share this code with new team members. They&rsquo;ll enter it on
          the onboarding screen to join your organization.
        </p>
      </header>

      <div className="invite-code-row">
        <code className="invite-code">{inviteCode}</code>
        <button
          type="button"
          className="btn btn--ghost invite-copy-btn"
          onClick={handleCopy}
          aria-label="Copy invite code to clipboard"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </section>
  )
}
