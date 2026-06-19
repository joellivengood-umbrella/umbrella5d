'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SignupForm } from './SignupForm'

/**
 * The guided, dark, branded account-setup wizard (Windows/Mac-first-boot
 * feel). PR 1 is the shell + the first two screens: Welcome and Create
 * Account. The account step reuses SignupForm, which (auto-confirmed signup +
 * sign-in) lands the user on /onboarding — where the existing chooser takes
 * over until a later PR brings the path steps (manage org / join / individual)
 * into the wizard itself.
 *
 * The step-machine + dark theme here are the reusable foundation for those
 * later screens.
 */

const PHASES = ['Welcome', 'Your account', 'Set up'] as const

export function SetupWizard() {
  const [phase, setPhase] = useState(0)

  return (
    <div className="wiz">
      <div className="wiz__panel">
        <div className="wiz-steps" aria-hidden="true">
          {PHASES.map((label, i) => (
            <span
              key={label}
              className={
                'wiz-steps__dot' +
                (i === phase ? ' is-active' : i < phase ? ' is-done' : '')
              }
            />
          ))}
        </div>

        {/* key={phase} remounts the screen so it plays its entrance animation */}
        <div className="wiz__screen" key={phase}>
          {phase === 0 ? (
            <div className="wiz-screen">
              <p className="wiz-eyebrow">Welcome</p>
              <h1 className="wiz-title">
                Welcome to <span className="mkt-grad">Umbrella</span>
              </h1>
              <p className="wiz-sub">
                Let&rsquo;s get you set up. It only takes a minute.
              </p>
              <button
                type="button"
                className="btn btn--primary btn--lg btn--full"
                onClick={() => setPhase(1)}
              >
                Get started
              </button>
              <p className="wiz-alt">
                Already have an account? <Link href="/login">Sign in</Link>
              </p>
            </div>
          ) : (
            <div className="wiz-screen">
              <button
                type="button"
                className="wiz-back"
                onClick={() => setPhase(0)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="15"
                  height="15"
                  aria-hidden="true"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <p className="wiz-eyebrow">Your account</p>
              <h1 className="wiz-title">Create your account</h1>
              <p className="wiz-sub">This is how you&rsquo;ll sign in.</p>
              <SignupForm />
              <p className="wiz-alt">
                Already have an account? <Link href="/login">Sign in</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
