import Link from 'next/link'
import Image from 'next/image'
import { AccountMenu } from './AccountMenu'
import { HeaderPageTitle } from './HeaderPageTitle'
import { MobileNavToggle } from './MobileNavToggle'

type AppNavProfile = {
  full_name: string | null
  role_title: string | null
  avatar_url: string | null
}

export function AppNav({ profile }: { profile: AppNavProfile | null }) {
  return (
    <header className="site-header site-header--app">
      <nav className="nav nav--app">
        <div className="nav-left">
          <MobileNavToggle />
          <Link className="nav-brand" href="/dashboard">
            <Image
              src="/logo/UmbrellaProgram_logo_Gray.png"
              alt="Umbrella Program"
              className="nav-logo-img"
              width={1453}
              height={384}
              priority
            />
          </Link>
          <HeaderPageTitle />
        </div>

        <div className="nav-actions">
          <Link
            href="/feed"
            className="nav-iconbtn"
            aria-label="Notifications"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="nav-iconbtn__dot" aria-hidden="true" />
          </Link>

          <span className="nav-divider" aria-hidden="true" />

          <AccountMenu
            fullName={profile?.full_name ?? null}
            roleTitle={profile?.role_title ?? null}
            avatarUrl={profile?.avatar_url ?? null}
          />
        </div>
      </nav>
    </header>
  )
}
