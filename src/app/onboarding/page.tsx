'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { SignOutButton } from '@/components/auth/SignOutButton'
import './onboarding.css'

type Path = 'create' | 'join' | 'individual' | null

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<Path>(null)
  const [orgName, setOrgName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState<'error' | 'success' | ''>('')
  const [loading, setLoading] = useState(false)
  // When a typed code turns out to be a PARTNER code, the join flow switches
  // into "name your new org (owned by the partner)" mode.
  const [partnerContext, setPartnerContext] = useState<{
    code: string
    name: string
  } | null>(null)
  const orgNameRef = useRef<HTMLInputElement>(null)

  // When the partner step appears, move focus to the org-name field.
  useEffect(() => {
    if (partnerContext) orgNameRef.current?.focus()
  }, [partnerContext])

  // Auth guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
        return
      }
      setUserId(session.user.id)
    })
  }, [router, supabase])

  function showError(msg: string) {
    setStatus(msg)
    setStatusType('error')
  }

  function selectPath(path: Exclude<Path, null>) {
    setSelectedPath(path)
    setStatus('')
    setStatusType('')
    setPartnerContext(null)
    setOrgName('')
    setInviteCode('')
  }

  const continueLabel =
    selectedPath === 'create'
      ? 'Create Organization'
      : selectedPath === 'join'
        ? partnerContext
          ? 'Create Organization'
          : 'Continue'
        : selectedPath === 'individual'
          ? 'Continue as Individual'
          : 'Select an option above'

  async function handleContinue() {
    if (!selectedPath || !userId) return
    setLoading(true)
    setStatus('')
    setStatusType('')

    try {
      if (selectedPath === 'create') {
        const name = orgName.trim()
        if (!name) {
          showError('Please enter an organization name.')
          return
        }
        // create_organization (SECURITY DEFINER RPC) atomically creates
        // the org, adds the caller as its first manager, and updates
        // their profile — no unguarded multi-write, no orphan org.
        const { error: rpcErr } = await supabase.rpc('create_organization', {
          _name: name,
        })
        if (rpcErr) {
          console.error('create_organization error', rpcErr)
          showError('Could not create organization. Please try again.')
          return
        }
        router.push('/dashboard')
        router.refresh()
      } else if (selectedPath === 'join') {
        // Step 2: a partner code was already recognised — create the caller's
        // new org owned by that partner (they become its manager).
        if (partnerContext) {
          const name = orgName.trim()
          if (!name) {
            showError('Please name your organization.')
            return
          }
          const { error: rpcErr } = await supabase.rpc('create_organization', {
            _name: name,
            _partner_code: partnerContext.code,
          })
          if (rpcErr) {
            if (rpcErr.message?.includes('INVALID_PARTNER_CODE')) {
              // Code went stale (e.g. the partner was removed since lookup).
              setPartnerContext(null)
              showError(
                'That partner code is no longer valid. Please re-enter your code.'
              )
            } else {
              console.error('create_organization (partner) error', rpcErr)
              showError('Could not create your organization. Please try again.')
            }
            return
          }
          router.push('/dashboard')
          router.refresh()
          return
        }

        // Step 1: classify the typed code (org vs partner vs invalid).
        const code = inviteCode.trim()
        if (!code) {
          showError('Please enter your invite code.')
          return
        }
        const { data, error: lookupErr } = await supabase.rpc(
          'lookup_invite_code',
          { _code: code }
        )
        if (lookupErr) {
          console.error('lookup_invite_code error', lookupErr)
          showError('Could not check that code. Please try again.')
          return
        }
        const match = data?.[0] as { kind: string; label: string } | undefined
        if (!match) {
          showError('Invalid invite code. Please check with whoever sent it.')
          return
        }
        if (match.kind === 'partner') {
          // Reveal the "name your org" step; the org is created on next submit.
          setPartnerContext({ code, name: match.label })
          setStatus('')
          setStatusType('')
          return
        }

        // Org code → join as a member (existing flow).
        const { error: rpcErr } = await supabase.rpc('join_organization', {
          _invite_code: code,
        })
        if (rpcErr) {
          if (rpcErr.message?.includes('INVALID_INVITE_CODE')) {
            showError(
              'Invalid invite code. Please check with your account manager.'
            )
          } else {
            console.error('join_organization error', rpcErr)
            showError('Could not join organization. Please try again.')
          }
          return
        }
        router.push('/dashboard')
        router.refresh()
      } else {
        await supabase
          .from('profiles')
          .update({
            org_id: null,
            organization_name: 'Individual',
            role_title: 'Individual',
          })
          .eq('id', userId)
        router.push('/dashboard')
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <header className="site-header" style={{ background: '#06060f' }}>
        <nav className="nav">
          <Link className="nav-brand" href="/dashboard">
            <Image
              src="/logo/Umbrella_logo.png"
              alt="Umbrella5D"
              className="nav-logo-img"
              width={200}
              height={52}
              priority
            />
          </Link>
          <div className="nav-actions">
            <SignOutButton />
          </div>
        </nav>
      </header>

      <main className="onboarding-bg">
        <div className="onboarding-card">
          <div className="onboarding-header">
            <div className="onboarding-logo">
              <Image
                src="/logo/Umbrella_icon.png"
                alt="Umbrella5D"
                width={72}
                height={72}
              />
            </div>
            <h1>Welcome to Umbrella5D</h1>
            <p>Let&rsquo;s get your account set up. How are you joining?</p>
          </div>

          <div className="path-options">
            <button
              className={`path-card${selectedPath === 'create' ? ' is-selected' : ''}`}
              type="button"
              onClick={() => selectPath('create')}
            >
              <div className="path-card__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="16" y1="11" x2="22" y2="11" />
                </svg>
              </div>
              <div className="path-card__text">
                <strong>Create an Organization</strong>
                <span>I&rsquo;m an account manager setting up my team</span>
              </div>
            </button>

            <button
              className={`path-card${selectedPath === 'join' ? ' is-selected' : ''}`}
              type="button"
              onClick={() => selectPath('join')}
            >
              <div className="path-card__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              </div>
              <div className="path-card__text">
                <strong>I have an invite code</strong>
                <span>From my organization or an Umbrella partner</span>
              </div>
            </button>

            <button
              className={`path-card${selectedPath === 'individual' ? ' is-selected' : ''}`}
              type="button"
              onClick={() => selectPath('individual')}
            >
              <div className="path-card__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="path-card__text">
                <strong>Continue as Individual</strong>
                <span>I&rsquo;m joining on my own, not as part of a team</span>
              </div>
            </button>
          </div>

          {selectedPath === 'create' && (
            <div className="path-panel is-visible">
              <div className="form-group">
                <label className="form-label" htmlFor="org-name">
                  Organization name
                </label>
                <input
                  className="form-input"
                  type="text"
                  id="org-name"
                  placeholder="e.g. Acme Sales Co."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleContinue()
                    }
                  }}
                />
              </div>
            </div>
          )}

          {selectedPath === 'join' && !partnerContext && (
            <div className="path-panel is-visible">
              <div className="form-group">
                <label className="form-label" htmlFor="invite-code">
                  Invite code
                </label>
                <input
                  className="form-input"
                  type="text"
                  id="invite-code"
                  placeholder="Enter your invite code"
                  autoComplete="off"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleContinue()
                    }
                  }}
                />
              </div>
            </div>
          )}

          {selectedPath === 'join' && partnerContext && (
            <div className="path-panel is-visible">
              <p className="onboarding-partner-note" aria-live="polite">
                You&rsquo;re joining under{' '}
                <strong>{partnerContext.name}</strong>. Name your organization
                to get started — you&rsquo;ll be its manager.
              </p>
              <div className="form-group">
                <label className="form-label" htmlFor="partner-org-name">
                  Organization name
                </label>
                <input
                  ref={orgNameRef}
                  className="form-input"
                  type="text"
                  id="partner-org-name"
                  placeholder="e.g. Acme Sales Co."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleContinue()
                    }
                  }}
                />
              </div>
              <button
                type="button"
                className="onboarding-backlink"
                onClick={() => {
                  setPartnerContext(null)
                  setInviteCode('')
                  setStatus('')
                  setStatusType('')
                }}
              >
                ← Use a different code
              </button>
            </div>
          )}

          <p
            className={`onboarding-status${statusType ? ` is-${statusType}` : ''}`}
          >
            {status}
          </p>

          <button
            className="btn btn--primary btn--full"
            type="button"
            disabled={!selectedPath || loading}
            onClick={handleContinue}
          >
            <span>{loading ? 'Working…' : continueLabel}</span>
            {loading && (
              <svg
                className="btn-spinner"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            )}
          </button>
        </div>
      </main>
    </>
  )
}
