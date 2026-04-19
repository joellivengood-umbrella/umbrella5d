import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to the Umbrella Program.',
}

export default function LoginPage() {
  return (
    <>
      {/* Minimal nav (logo only) */}
      <header className="site-header">
        <nav className="nav">
          <Link className="nav-brand" href="/">
            <Image
              src="/logo/Umbrella_logo.png"
              alt="Umbrella5D"
              className="nav-logo-img"
              width={200}
              height={52}
              priority
            />
          </Link>
          <Link href="/" className="nav-signin login-back-link">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="16"
              height="16"
              aria-hidden="true"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to site
          </Link>
        </nav>
      </header>

      <main className="login-bg">
        <div className="login-card">
          <div className="login-card__header">
            <div className="login-logo" aria-hidden="true">
              <Image
                src="/logo/Umbrella_icon.png"
                alt="Umbrella5D"
                className="login-logo-img"
                width={48}
                height={48}
              />
            </div>
            <h1>Welcome back</h1>
            <p>Sign in to the Umbrella Program</p>
          </div>

          <LoginForm />

          <div className="login-divider">
            <span>or</span>
          </div>

          <p className="login-alt">
            Don&rsquo;t have an account?&nbsp;<Link href="/signup">Create one free</Link>
          </p>
        </div>
      </main>
    </>
  )
}
