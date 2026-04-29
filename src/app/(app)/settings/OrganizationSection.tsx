'use client'

import { useState } from 'react'

/**
 * Organization section on the Settings page, manager-only.
 *
 * Surfaces the org's invite code so a manager can share it with new
 * members. Onboarding's "Join Organization" flow asks for this code,
 * but until now there was no UI to discover it — managers were stuck
 * going to the SQL editor. This unblocks the join flow for real teams.
 *
 * Read-only by design. Regenerating an invite code (e.g. if it leaks)
 * is a future feature; we'll add it when there's a real reason to.
 */
export function OrganizationSection({
  organizationName,
  inviteCode,
}: {
  organizationName: string
  inviteCode: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      // Reset the "Copied!" label after a beat so the button is reusable.
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Browsers can refuse clipboard writes (insecure context, perms).
      // Fall back to a manual selection prompt — better than silence.
      window.prompt('Copy your invite code:', inviteCode)
    }
  }

  return (
    <section className="settings-section">
      <header className="settings-section__header">
        <h2>Organization</h2>
        <p>Manage your team&rsquo;s settings and invite new members.</p>
      </header>

      <div className="settings-form">
        <div className="settings-field">
          <span>Organization name</span>
          <p className="settings-readonly">{organizationName}</p>
        </div>

        <div className="settings-field">
          <span>Invite code</span>
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
          <span className="settings-hint">
            Share this with new team members. They&rsquo;ll enter it on the
            onboarding screen to join your organization.
          </span>
        </div>
      </div>
    </section>
  )
}
