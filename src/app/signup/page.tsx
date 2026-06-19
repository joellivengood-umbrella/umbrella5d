import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { SetupWizard } from '@/components/auth/SetupWizard'

export const metadata: Metadata = {
  title: 'Get started',
  description: 'Create your free Umbrella account.',
}

export default function SignupPage() {
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
        <SetupWizard />
      </main>
    </>
  )
}
