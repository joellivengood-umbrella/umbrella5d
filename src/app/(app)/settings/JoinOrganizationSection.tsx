'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Settings section shown only to INDIVIDUAL accounts (no organization). Lets a
 * solo user join an existing organization after the fact by entering that
 * org's invite code — the same join_organization definer RPC the onboarding
 * wizard uses (validates the code, inserts an org_members 'member' row, sets
 * profiles.org_id/organization_name). On success we refresh so the rest of the
 * app picks up the new org (nav, team, feed). Managers, members, and partners
 * never see this section.
 */
type Status = { type: 'success' | 'error'; msg: string } | null

export function JoinOrganizationSection() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const clean = code.trim()
    if (!clean) {
      setStatus({ type: 'error', msg: 'Enter your organization’s invite code.' })
      return
    }
    setBusy(true)
    setStatus(null)

    const { error } = await supabase.rpc('join_organization', {
      _invite_code: clean,
    })

    if (error) {
      setBusy(false)
      if (error.message?.includes('INVALID_INVITE_CODE')) {
        setStatus({
          type: 'error',
          msg: 'That code didn’t match any organization — check it with the organization’s manager.',
        })
      } else {
        console.error('join_organization error', error)
        setStatus({ type: 'error', msg: 'Could not join. Please try again.' })
      }
      return
    }

    setStatus({ type: 'success', msg: 'Joined! Loading your organization…' })
    // Re-render server components so the new org shows up across the app; this
    // section then unmounts (the user is no longer an individual).
    router.refresh()
  }

  return (
    <section className="settings-section">
      <header className="settings-section__header">
        <h2>Join an organization</h2>
        <p>
          Have an invite code from an organization? Enter it here to join their
          team.
        </p>
      </header>

      <form onSubmit={handleJoin} className="settings-form">
        <label className="settings-field">
          <span>Organization invite code</span>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setStatus(null)
            }}
            placeholder="Enter invite code"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
        <div className="settings-actions">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={busy || !code.trim()}
          >
            {busy ? 'Joining…' : 'Join organization'}
          </button>
          {status && (
            <span
              className={`settings-status settings-status--${status.type}`}
              role={status.type === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {status.msg}
            </span>
          )}
        </div>
      </form>
    </section>
  )
}
