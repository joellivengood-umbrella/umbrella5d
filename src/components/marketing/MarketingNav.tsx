import Link from 'next/link'
import Image from 'next/image'

/**
 * Top navigation for the public marketing site.
 */
export function MarketingNav({
  active,
}: {
  active?: 'machine' | 'faq' | 'contact'
}) {
  return (
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

        <ul className="nav-links">
          <li>
            <Link
              href="/5d-machine"
              aria-current={active === 'machine' ? 'page' : undefined}
            >
              5D Machine
            </Link>
          </li>
          <li>
            <Link
              href="/faq"
              aria-current={active === 'faq' ? 'page' : undefined}
            >
              FAQ
            </Link>
          </li>
          <li>
            <Link href="/#contact">Contact</Link>
          </li>
        </ul>

        <div className="nav-actions">
          <Link href="/login" className="nav-signin">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn--primary btn--sm">
            Sign Up Now
          </Link>
        </div>
      </nav>
    </header>
  )
}
