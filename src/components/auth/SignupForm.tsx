'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function SignupForm() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    // 1) Create the user server-side (auto-confirmed) via our admin route.
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      }),
    })
    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      setLoading(false)
      setError(body?.error || 'Could not create account.')
      return
    }

    // 2) Sign in on the client so the session cookie gets set.
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setLoading(false)
      setError(signInError.message)
      return
    }

    router.push('/onboarding')
    router.refresh()
  }

  return (
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      <div className="form-group">
        <label className="form-label" htmlFor="full-name">
          Full name
        </label>
        <input
          className="form-input"
          type="text"
          id="full-name"
          name="full-name"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="email">
          Email address
        </label>
        <input
          className="form-input"
          type="email"
          id="email"
          name="email"
          autoComplete="email"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="password">
          Password
        </label>
        <div className="form-input-wrap">
          <input
            className="form-input"
            type={showPw ? 'text' : 'password'}
            id="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
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

      {error && (
        <p
          style={{
            color: '#f87171',
            fontSize: '.875rem',
            textAlign: 'center',
            marginBottom: '.75rem',
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn btn--primary btn--full"
        disabled={loading}
      >
        <span>{loading ? 'Creating account…' : 'Create free account'}</span>
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
    </form>
  )
}
