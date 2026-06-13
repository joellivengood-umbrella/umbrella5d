import Link from 'next/link'

/**
 * Slim in-app footer: a muted utility strip pinned to the bottom of the
 * app shell. Replaces the marketing footer (brochure tagline + "Sign Up"
 * CTA), which doesn't belong inside the authenticated product — most
 * SaaS apps either drop the footer in-product or keep a thin legal strip
 * like this one. Legal links mirror the marketing footer's targets
 * (still placeholders until those pages exist).
 */
export function AppFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="app-footer">
      <span className="app-footer__copy">© {year} Umbrella Program</span>
      <nav className="app-footer__links" aria-label="Legal and support">
        <Link href="#">Privacy</Link>
        <Link href="#">Terms</Link>
        <a href="mailto:support@bz5d.com">Support</a>
      </nav>
    </footer>
  )
}
