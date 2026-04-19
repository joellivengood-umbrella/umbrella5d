'use client'

import { useEffect, useState } from 'react'
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
  }

  const continueLabel =
    selectedPath === 'create'
      ? 'Create Organization'
      : selectedPath === 'join'
        ? 'Join Organization'
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
        const { data: org, error: orgErr } = await supabase
          .from('organizations')
          .insert({ name, owner_id: userId, plan_tier: 'organization' })
          .select()
          .single()
        if (orgErr || !org) {
          showError('Could not create organization. Please try again.')
          return
        }
        const { error: memberErr } = await supabase
          .from('org_members')
          .insert({ org_id: org.id, user_id: userId, role: 'admin' })
        if (memberErr) {
          showError('Organization created but could not assign role. Contact support.')
          return
        }
        await supabase
          .from('profiles')
          .update({
            org_id: org.id,
            organization_name: name,
            role_title: 'Account Manager',
          })
          .eq('id', userId)
        router.push('/dashboard')
        router.refresh()
      } else if (selectedPath === 'join') {
        const code = inviteCode.trim()
        if (!code) {
          showError('Please enter your invite code.')
          return
        }
        const { data: org, error: orgErr } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('invite_code', code)
          .single()
        if (orgErr || !org) {
          showError('Invalid invite code. Please check with your account manager.')
          return
        }
        const { data: existing } = await supabase
          .from('org_members')
          .select('id')
          .eq('org_id', org.id)
          .eq('user_id', userId)
          .single()
        if (existing) {
          router.push('/dashboard')
          router.refresh()
          return
        }
        const { error: memberErr } = await supabase
          .from('org_members')
          .insert({ org_id: org.id, user_id: userId, role: 'member' })
        if (memberErr) {
          showError('Could not join organization. Please try again.')
          return
        }
        await supabase
          .from('profiles')
          .update({
            org_id: org.id,
            organization_name: org.name,
            role_title: 'Member',
          })
          .eq('id', userId)
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
                <strong>Join an Organization</strong>
                <span>I have an invite code from my account manager</span>
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
                />
              </div>
            </div>
          )}

          {selectedPath === 'join' && (
            <div className="path-panel is-visible">
              <div className="form-group">
                <label className="form-label" htmlFor="invite-code">
                  Invite code
                </label>
                <input
                  className="form-input"
                  type="text"
                  id="invite-code"
                  placeholder="Enter your 8-character invite code"
                  autoComplete="off"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                />
              </div>
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
