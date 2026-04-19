import Link from 'next/link'
import Image from 'next/image'
import { SignOutButton } from '@/components/auth/SignOutButton'

export function AppNav() {
  return (
    <header className="site-header">
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
  )
}
