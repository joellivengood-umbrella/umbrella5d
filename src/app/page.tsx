import Link from 'next/link'
import type { Metadata } from 'next'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'

export const metadata: Metadata = {
  title: 'Umbrella5D — Revenue. Profits. Glory.',
  description:
    'The only program built on all five dimensions of your business. 32 precise steps to transform any business into a profit machine.',
}

export default function LandingPage() {
  return (
    <>
      <MarketingNav />

      <main>
        {/* ── HERO ── */}
        <section className="hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-dot" />
              The Program &middot; Now Enrolling
            </div>

            <h1 className="hero-headline">
              <span style={{ whiteSpace: 'nowrap' }}>
                The only program built on
              </span>
              <br />
              <span className="headline-accent">all five dimensions</span>
              <br />
              of your business.
            </h1>

            <p className="hero-sub">
              There are irrefutable laws that govern the business universe. The
              Umbrella Program is the only detailed, comprehensive solution to
              put those laws to work — transforming any business into a profit
              machine.
            </p>

            <div className="hero-actions">
              <Link href="/login" className="btn btn--primary btn--lg">
                Start for free
              </Link>
              <Link href="/features" className="btn btn--ghost btn--lg">
                See how it works
              </Link>
            </div>

            <p className="hero-proof">
              32 precise steps — any business, any size — results in 6 weeks.
            </p>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="features">
          <div className="container">
            <div className="section-header">
              <p className="section-eyebrow">Why the Umbrella Program</p>
              <h2 className="section-title">
                The complete transformation. Nothing left out.
              </h2>
              <p className="section-sub">
                The customer paradigm has shifted. Customers want complete and
                total benefit — across every dimension. The Umbrella Program is
                the only comprehensive solution.
              </p>
            </div>

            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
                <h3>The 32-Step Machine</h3>
                <p>
                  An online, cloud-based tool incorporating 32 precise
                  instruction sets, completed over six weeks, to transform any
                  business into a profit machine.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </div>
                <h3>Guide at Your Side</h3>
                <p>
                  You&rsquo;re never on your own. Every step comes with expert
                  guidance, business history examples, and clear objectives —
                  before the instruction even begins.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h3>Any Business, Any Size</h3>
                <p>
                  From a one-chair barber shop to Tesla. The Umbrella Program
                  works regardless of industry, size, or stage of growth.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA BAND ── */}
        <section id="about" className="cta-band">
          <div className="container">
            <h2>Ready to see what five dimensions can do?</h2>
            <p>
              The only program of its kind, anywhere in the world. It&rsquo;s
              time to stop waiting and start profiting.
            </p>
            <Link href="/login" className="btn btn--white btn--lg">
              Get started — it&rsquo;s free
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </>
  )
}
