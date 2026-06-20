'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/**
 * "Forgot password" — request a reset link. Sends the user a Supabase
 * password-recovery email that lands back on /reset-password. We always show
 * the same success state regardless of whether the email has an account, so
 * the form can't be used to probe which addresses are registered.
 */
export function ForgotPasswordForm() {
  const [supabase] = useState(() => createClient())
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const addr = email.trim()
    if (!addr) {
      setError('Please enter your email.')
      return
    }
    setLoading(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      addr,
      { redirectTo: `${window.location.origin}/reset-password` }
    )
    setLoading(false)
    if (resetError) {
      console.error('resetPasswordForEmail error', resetError)
      setError('Could not send the reset email. Please try again.')
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="wiz-screen">
        <p className="wiz-eyebrow">Check your email</p>
        <h1 className="wiz-title">Reset link sent</h1>
        <p className="wiz-sub">
          If an account exists for <strong>{email.trim()}</strong>, we&rsquo;ve
          emailed a link to reset your password. It expires in an hour.
        </p>
        <Link href="/login" className="btn btn--ghost btn--lg btn--full">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="wiz-screen">
      <p className="wiz-eyebrow">Reset password</p>
      <h1 className="wiz-title">Forgot your password?</h1>
      <p className="wiz-sub">
        Enter your email and we&rsquo;ll send you a link to reset it.
      </p>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="email">
            Email address
          </label>
          <input
            className="form-input"
            id="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {error && <p className="wiz-error">{error}</p>}

        <button
          type="submit"
          className="btn btn--primary btn--full"
          disabled={loading}
        >
          <span>{loading ? 'Sending…' : 'Send reset link'}</span>
          {loading && (
            <svg className="btn-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          )}
        </button>
      </form>

      <p className="wiz-alt">
        <Link href="/login">← Back to sign in</Link>
      </p>
    </div>
  )
}
