'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

/**
 * Top navigation for the public marketing site.
 *
 * On desktop: logo, inline page links, and Sign in / Sign Up Now.
 * On mobile (<=640px): the inline links and actions collapse into a
 * hamburger menu that drops down with the page links plus Sign in and
 * Sign Up Now. Scoped with the `nav--mkt` class so the shared
 * `.nav` / `.site-header` styles used by the signed-in app header are
 * not affected.
 */
export function MarketingNav({
  active,
}: {
  active?: 'machine' | 'faq' | 'contact'
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <header className="site-header">
      <nav className="nav nav--mkt">
        <Link className="nav-brand" href="/" onClick={close}>
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

        <button
          type="button"
          className="mkt-nav-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </nav>

      {open && (
        <>
          <div className="mkt-mobile-backdrop" onClick={close} aria-hidden="true" />
          <div className="mkt-mobile-menu">
            <Link href="/5d-machine" onClick={close}>5D Machine</Link>
            <Link href="/faq" onClick={close}>FAQ</Link>
            <Link href="/#contact" onClick={close}>Contact</Link>
            <div className="mkt-mobile-menu__divider" />
            <Link href="/login" onClick={close} className="mkt-mobile-menu__signin">
              Sign in
            </Link>
            <Link
              href="/signup"
              onClick={close}
              className="btn btn--primary btn--full mkt-mobile-menu__cta"
            >
              Sign Up Now
            </Link>
          </div>
        </>
      )}
    </header>
  )
}
