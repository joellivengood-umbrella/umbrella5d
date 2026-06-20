'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * "Set a new password" — the landing page for the recovery email link.
 *
 * On mount it establishes the recovery session: if Supabase already exchanged
 * the link (a session exists) we proceed; otherwise we exchange the ?code in
 * the URL for a session. With that session, updateUser sets the new password.
 * An invalid/expired/cross-browser link shows a friendly "request a new one".
 */
type Stage = 'verifying' | 'ready' | 'invalid' | 'done'

export function ResetPasswordForm() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [stage, setStage] = useState<Stage>('verifying')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      // The recovery link may already be exchanged into a session by the
      // client; if so, just proceed.
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        setStage('ready')
        return
      }
      const code = new URLSearchParams(window.location.search).get('code')
      if (!code) {
        setStage('invalid')
        return
      }
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code)
      setStage(exchangeError ? 'invalid' : 'ready')
    }
    init()
  }, [supabase])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setStage('done')
  }

  if (stage === 'verifying') {
    return (
      <div className="wiz-screen">
        <p className="wiz-sub" style={{ margin: 0 }}>
          Verifying your link…
        </p>
      </div>
    )
  }

  if (stage === 'invalid') {
    return (
      <div className="wiz-screen">
        <p className="wiz-eyebrow">Reset password</p>
        <h1 className="wiz-title">This link isn&rsquo;t valid</h1>
        <p className="wiz-sub">
          It may have expired or already been used. Request a fresh one — and
          open it in the same browser you requested it from.
        </p>
        <Link
          href="/forgot-password"
          className="btn btn--primary btn--lg btn--full"
        >
          Request a new link
        </Link>
      </div>
    )
  }

  if (stage === 'done') {
    return (
      <div className="wiz-screen">
        <p className="wiz-eyebrow">All set</p>
        <h1 className="wiz-title">
          Password <span className="mkt-grad">updated</span>
        </h1>
        <p className="wiz-sub">You&rsquo;re signed in with your new password.</p>
        <button
          type="button"
          className="btn btn--primary btn--lg btn--full"
          onClick={() => {
            router.push('/dashboard')
            router.refresh()
          }}
        >
          Go to my dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="wiz-screen">
      <p className="wiz-eyebrow">Reset password</p>
      <h1 className="wiz-title">Set a new password</h1>
      <p className="wiz-sub">Choose a new password for your account.</p>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="new-password">
            New password
          </label>
          <div className="form-input-wrap">
            <input
              className="form-input"
              id="new-password"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              autoFocus
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="pw-toggle"
              aria-label={showPw ? 'Hide password' : 'Show password'}
              onClick={() => setShowPw((s) => !s)}
            >
              {!showPw ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && <p className="wiz-error">{error}</p>}

        <button
          type="submit"
          className="btn btn--primary btn--full"
          disabled={loading}
        >
          <span>{loading ? 'Updating…' : 'Update password'}</span>
          {loading && (
            <svg className="btn-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          )}
        </button>
      </form>
    </div>
  )
}
