import Link from 'next/link'
import Image from 'next/image'

/**
 * Top navigation for the public marketing site.
 * Use on: landing, features, pricing, etc.
 */
export function MarketingNav({ active }: { active?: 'features' | 'about' | 'contact' }) {
  return (
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

        <ul className="nav-links">
          <li><Link href="/features" aria-current={active === 'features' ? 'page' : undefined}>Features</Link></li>
          <li><Link href="/#about" aria-current={active === 'about' ? 'page' : undefined}>About</Link></li>
          <li><Link href="/#contact" aria-current={active === 'contact' ? 'page' : undefined}>Contact</Link></li>
        </ul>

        <div className="nav-actions">
          <Link href="/login" className="nav-signin">Sign in</Link>
          <Link href="/login" className="btn btn--primary btn--sm">
            Get started free
          </Link>
        </div>
      </nav>
    </header>
  )
}
