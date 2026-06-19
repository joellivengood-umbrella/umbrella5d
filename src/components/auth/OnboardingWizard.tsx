'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * The path half of the setup wizard (dark, branded — matches /signup so the
 * hand-off is seamless). The user is already authenticated by the time they
 * land here. Three paths, following the flowchart:
 *   - manage an org  → "do you have a partner code?" → (code) → name org →
 *     create_organization (with optional partner code)
 *   - have an invite code → enter org code → join_organization
 *   - by myself → mark the profile individual
 * Each commit leaves the profile in a state the onboarding gate accepts, then
 * a final "all set" screen sends them to the dashboard.
 */

type Phase =
  | 'path'
  | 'partnerQ'
  | 'partnerCode'
  | 'orgName'
  | 'joinCode'
  | 'individual'
  | 'done'

export function OnboardingWizard({ userId }: { userId: string }) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [phase, setPhase] = useState<Phase>('path')
  const [hasPartner, setHasPartner] = useState(false)
  const [partnerCode, setPartnerCode] = useState('')
  const [orgName, setOrgName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function go(p: Phase) {
    setError(null)
    setPhase(p)
  }

  async function createOrg() {
    const name = orgName.trim()
    if (!name) {
      setError('Please enter an organization name.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: e } = await supabase.rpc('create_organization', {
      _name: name,
      _partner_code: hasPartner ? partnerCode.trim() || null : null,
    })
    setBusy(false)
    if (e) {
      if (e.message?.includes('INVALID_PARTNER_CODE')) {
        setError('That partner code isn’t valid — go back and re-enter it.')
      } else {
        console.error('create_organization error', e)
        setError('Could not create your organization. Please try again.')
      }
      return
    }
    setPhase('done')
  }

  async function joinOrg() {
    const code = joinCode.trim()
    if (!code) {
      setError('Please enter your invite code.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: e } = await supabase.rpc('join_organization', {
      _invite_code: code,
    })
    setBusy(false)
    if (e) {
      if (e.message?.includes('INVALID_INVITE_CODE')) {
        setError('That code isn’t valid — check with your account manager.')
      } else {
        console.error('join_organization error', e)
        setError('Could not join. Please try again.')
      }
      return
    }
    setPhase('done')
  }

  async function continueIndividual() {
    setBusy(true)
    setError(null)
    const { error: e } = await supabase
      .from('profiles')
      .update({
        org_id: null,
        organization_name: 'Individual',
        role_title: 'Individual',
      })
      .eq('id', userId)
    setBusy(false)
    if (e) {
      console.error('individual onboarding error', e)
      setError('Something went wrong. Please try again.')
      return
    }
    setPhase('done')
  }

  function toDashboard() {
    router.push('/dashboard')
    router.refresh()
  }

  const enter =
    (fn: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        fn()
      }
    }

  return (
    <div className="wiz">
      <div className="wiz__panel">
        <div className="wiz__screen" key={phase}>
          {phase === 'path' && (
            <div className="wiz-screen">
              <p className="wiz-eyebrow">Get set up</p>
              <h1 className="wiz-title">Which fits best for you?</h1>
              <p className="wiz-sub">Pick how you&rsquo;re joining Umbrella.</p>

              <div className="wiz-paths">
                <button
                  type="button"
                  className="wiz-path"
                  onClick={() => go('partnerQ')}
                >
                  <span className="wiz-path__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="19" y1="8" x2="19" y2="14" />
                      <line x1="16" y1="11" x2="22" y2="11" />
                    </svg>
                  </span>
                  <span className="wiz-path__text">
                    <strong>I manage an organization</strong>
                    <span>Set up a team and invite members</span>
                  </span>
                  <span className="wiz-path__chev" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </span>
                </button>

                <button
                  type="button"
                  className="wiz-path"
                  onClick={() => go('joinCode')}
                >
                  <span className="wiz-path__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                  </span>
                  <span className="wiz-path__text">
                    <strong>I have an invite code</strong>
                    <span>Join your organization as a member</span>
                  </span>
                  <span className="wiz-path__chev" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </span>
                </button>

                <button
                  type="button"
                  className="wiz-path"
                  onClick={() => go('individual')}
                >
                  <span className="wiz-path__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <span className="wiz-path__text">
                    <strong>I&rsquo;m signing up by myself</strong>
                    <span>Go through the program on your own</span>
                  </span>
                  <span className="wiz-path__chev" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </span>
                </button>
              </div>
            </div>
          )}

          {phase === 'partnerQ' && (
            <div className="wiz-screen">
              <BackBtn onClick={() => go('path')} />
              <p className="wiz-eyebrow">Your organization</p>
              <h1 className="wiz-title">Do you have a partner invite code?</h1>
              <p className="wiz-sub">
                If an Umbrella partner gave you a code, you&rsquo;ll enter it
                next.
              </p>
              <div className="wiz-choice-row">
                <button
                  type="button"
                  className="btn btn--ghost btn--lg"
                  onClick={() => {
                    setHasPartner(false)
                    go('orgName')
                  }}
                >
                  No
                </button>
                <button
                  type="button"
                  className="btn btn--primary btn--lg"
                  onClick={() => {
                    setHasPartner(true)
                    go('partnerCode')
                  }}
                >
                  Yes
                </button>
              </div>
            </div>
          )}

          {phase === 'partnerCode' && (
            <div className="wiz-screen">
              <BackBtn onClick={() => go('partnerQ')} />
              <p className="wiz-eyebrow">Partner code</p>
              <h1 className="wiz-title">Enter your partner code</h1>
              <p className="wiz-sub">From the Umbrella partner you&rsquo;re joining under.</p>
              <div className="form-group">
                <label className="form-label" htmlFor="partner-code">Partner code</label>
                <input
                  className="form-input"
                  id="partner-code"
                  type="text"
                  autoComplete="off"
                  autoFocus
                  placeholder="Paste your partner code"
                  value={partnerCode}
                  onChange={(e) => setPartnerCode(e.target.value)}
                  onKeyDown={enter(() => go('orgName'))}
                />
              </div>
              {error && <p className="wiz-error">{error}</p>}
              <button
                type="button"
                className="btn btn--primary btn--full"
                onClick={() => go('orgName')}
              >
                Continue
              </button>
            </div>
          )}

          {phase === 'orgName' && (
            <div className="wiz-screen">
              <BackBtn onClick={() => go(hasPartner ? 'partnerCode' : 'partnerQ')} />
              <p className="wiz-eyebrow">Your organization</p>
              <h1 className="wiz-title">Name your organization</h1>
              <p className="wiz-sub">You&rsquo;ll be its manager — you can change this later.</p>
              <div className="form-group">
                <label className="form-label" htmlFor="org-name">Organization name</label>
                <input
                  className="form-input"
                  id="org-name"
                  type="text"
                  autoFocus
                  placeholder="e.g. Acme Sales Co."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  onKeyDown={enter(createOrg)}
                />
              </div>
              {error && <p className="wiz-error">{error}</p>}
              <SubmitBtn busy={busy} label="Create organization" onClick={createOrg} />
            </div>
          )}

          {phase === 'joinCode' && (
            <div className="wiz-screen">
              <BackBtn onClick={() => go('path')} />
              <p className="wiz-eyebrow">Join your team</p>
              <h1 className="wiz-title">Enter your invite code</h1>
              <p className="wiz-sub">Your account manager gave you this code.</p>
              <div className="form-group">
                <label className="form-label" htmlFor="join-code">Invite code</label>
                <input
                  className="form-input"
                  id="join-code"
                  type="text"
                  autoComplete="off"
                  autoFocus
                  placeholder="Enter your invite code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  onKeyDown={enter(joinOrg)}
                />
              </div>
              {error && <p className="wiz-error">{error}</p>}
              <SubmitBtn busy={busy} label="Join organization" onClick={joinOrg} />
            </div>
          )}

          {phase === 'individual' && (
            <div className="wiz-screen">
              <BackBtn onClick={() => go('path')} />
              <p className="wiz-eyebrow">Just you</p>
              <h1 className="wiz-title">Continue on your own</h1>
              <p className="wiz-sub">
                You&rsquo;ll go through the full program solo. You can join a
                team later with an invite code.
              </p>
              {error && <p className="wiz-error">{error}</p>}
              <SubmitBtn busy={busy} label="Continue" onClick={continueIndividual} />
            </div>
          )}

          {phase === 'done' && (
            <div className="wiz-screen">
              <p className="wiz-eyebrow">All set</p>
              <h1 className="wiz-title">
                You&rsquo;re <span className="mkt-grad">all set</span>
              </h1>
              <p className="wiz-sub">Let&rsquo;s head to your dashboard.</p>
              <button
                type="button"
                className="btn btn--primary btn--lg btn--full"
                onClick={toDashboard}
              >
                Go to my dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="wiz-back" onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  )
}

function SubmitBtn({
  busy,
  label,
  onClick,
}: {
  busy: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="btn btn--primary btn--full"
      disabled={busy}
      onClick={onClick}
    >
      <span>{busy ? 'Working…' : label}</span>
      {busy && (
        <svg className="btn-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      )}
    </button>
  )
}
