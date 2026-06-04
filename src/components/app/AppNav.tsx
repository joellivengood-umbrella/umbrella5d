import Link from 'next/link'
import Image from 'next/image'
import { AccountMenu } from './AccountMenu'

type AppNavProfile = {
  full_name: string | null
  role_title: string | null
  avatar_url: string | null
}

export function AppNav({ profile }: { profile: AppNavProfile | null }) {
  return (
    <header className="site-header">
      <nav className="nav nav--app">
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
