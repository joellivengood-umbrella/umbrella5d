import Link from 'next/link'
import Image from 'next/image'

/**
 * Marketing-site footer. Includes brand, link groups, legal.
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
                alt="Umbrella5D"
                className="nav-logo-img"
                width={200}
                height={52}
              />
            </Link>
            <p className="footer-tagline">Revenue. Profits. Glory.</p>
          </div>

          <div className="footer-links-group">
            <div className="footer-col">
              <h4>Product</h4>
              <ul>
                <li><Link href="/features">Features</Link></li>
                <li><Link href="#">Pricing</Link></li>
                <li><Link href="#">Changelog</Link></li>
                <li><Link href="#">Roadmap</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <ul>
                <li><Link href="#">About</Link></li>
                <li><Link href="#">Blog</Link></li>
                <li><Link href="#">Careers</Link></li>
                <li><Link href="#">Press</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Support</h4>
              <ul>
                <li><Link href="#">Docs</Link></li>
                <li><Link href="#">Community</Link></li>
                <li><a href="mailto:hello@umbrella5d.com">Contact</a></li>
                <li><Link href="#">Status</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2026 Umbrella5D, Inc. All rights reserved.</p>
          <div className="footer-legal">
            <Link href="#">Privacy Policy</Link>
            <Link href="#">Terms of Service</Link>
            <Link href="#">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
