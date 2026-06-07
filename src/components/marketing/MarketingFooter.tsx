import Link from 'next/link'
import Image from 'next/image'

/**
 * Marketing-site footer. Doubles as the Contact anchor (#contact).
 */
export function MarketingFooter() {
  return (
    <footer className="site-footer" id="contact">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <Link className="nav-brand footer-logo" href="/">
              <Image
                src="/logo/Umbrella_logo.png"
                alt="Umbrella"
                className="nav-logo-img"
                width={200}
                height={52}
              />
            </Link>
            <p className="footer-tagline">
              The step by step system that turns any company into a
              profit focused company.
            </p>
            <Link href="/signup" className="btn btn--primary btn--sm footer-cta">
              Sign Up Now
            </Link>
          </div>

          <div className="footer-links-group">
            <div className="footer-col">
              <h4>Program</h4>
              <ul>
                <li><Link href="/5d-machine">5D Machine</Link></li>
                <li><Link href="/faq">FAQ</Link></li>
                <li><Link href="/signup">Create account</Link></li>
                <li><Link href="/login">Sign in</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Contact</h4>
              <ul>
                <li><a href="mailto:hello@bz5d.com">hello@bz5d.com</a></li>
                <li><a href="mailto:support@bz5d.com">support@bz5d.com</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2026 Umbrella. All rights reserved.</p>
          <div className="footer-legal">
            <Link href="#">Privacy Policy</Link>
            <Link href="#">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
