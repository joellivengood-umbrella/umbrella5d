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
      {/* Minimal nav (logo + escape hatch) */}
      <header className="site-header">
        <nav className="nav">
          <Link className="nav-brand" href="/">
            <Image
              src="/logo/Umbrella_logo.png"
              alt="Umbrella"
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

      <main className="wiz-bg">
        <div className="wiz">
          <div className="wiz__panel">
            <p className="wiz-eyebrow">Sign in</p>
            <h1 className="wiz-title">Welcome back</h1>
            <p className="wiz-sub">Sign in to continue your program.</p>

            <LoginForm />

            <p className="wiz-alt">
              Don&rsquo;t have an account? <Link href="/signup">Get started</Link>
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
