import Link from 'next/link'
import type { Metadata } from 'next'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'

export const metadata: Metadata = {
  title: 'Umbrella | Turn any company into a profit machine.',
  description:
    'The Umbrella Program and its 5D Machine walk every person in your business through the exact steps to find profit and act on it. One system, one direction, real results.',
}

export default function LandingPage() {
  return (
    <>
      <MarketingNav />

      <main>
        {/* ── HERO ── */}
        <section className="mkt-hero">
          <div className="mkt-hero__glow" aria-hidden="true" />
          <div className="container mkt-hero__grid">
            <div className="mkt-hero__copy">
              <p className="mkt-eyebrow">The Umbrella Program</p>
              <h1 className="mkt-hero__title">
                Turn any company into a{' '}
                <span className="mkt-grad">profit machine</span>.
              </h1>
              <p className="mkt-hero__sub">
                The 5D Machine walks every person in your business, from the
                front desk to the corner office, through the exact steps to
                find profit and act on it. One system. One direction. Real
                results.
              </p>
              <div className="mkt-hero__actions">
                <Link href="/signup" className="btn btn--primary btn--lg">
                  Sign Up Now
                </Link>
                <Link href="/5d-machine" className="btn btn--ghost btn--lg">
                  Explore the 5D Machine
                </Link>
              </div>
              <p className="mkt-hero__proof">
                30 guided segments. 5 dimensions of your business. Everyone on
                the same page.
              </p>
            </div>

            {/* Stylized product mockup */}
            <div className="mkt-hero__art" aria-hidden="true">
              <div className="mock mock--machine">
                <div className="mock__bar">
                  <span /><span /><span />
                </div>
                <div className="mock__body">
                  <div className="mock-machine__head">
                    <span className="mock-tag">5D Machine</span>
                    <span className="mock-machine__pct">23%</span>
                  </div>
                  <div className="mock-machine__rows">
                    <div className="mock-row is-done">
                      <span className="mock-row__n">01</span>
                      <span className="mock-row__t">Name the real business you are in</span>
                      <span className="mock-row__check" />
                    </div>
                    <div className="mock-row is-done">
                      <span className="mock-row__n">02</span>
                      <span className="mock-row__t">Map where the money comes from</span>
                      <span className="mock-row__check" />
                    </div>
                    <div className="mock-row is-active">
                      <span className="mock-row__n">03</span>
                      <span className="mock-row__t">Cut what quietly drains profit</span>
                      <span className="mock-row__play" />
                    </div>
                    <div className="mock-row">
                      <span className="mock-row__n">04</span>
                      <span className="mock-row__t">Define your profit engine</span>
                    </div>
                    <div className="mock-row">
                      <span className="mock-row__n">05</span>
                      <span className="mock-row__t">Set the one number that matters</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PROBLEM ── */}
        <section className="mkt-section mkt-problem">
          <div className="container mkt-split">
            <div className="mkt-split__lead">
              <p className="mkt-eyebrow">The problem</p>
              <h2 className="mkt-h2"> 
				Your company isn't aligned. Profits suffer.
              </h2>
            </div>
            <ul className="mkt-problem__list">
              <li>
                <strong>Everyone optimizes for their own corner.</strong> Sales
                chases volume, ops chases speed, and nobody is pointed at
                profit.
              </li>
              <li>
                <strong>The plan lives in one person’s head.</strong> The
                strategy to grow rarely makes it past the leadership team.
              </li>
              <li>
                <strong>Your people want to help.</strong> They have just never
                been shown how their daily work moves the bottom line.
              </li>
            </ul>
          </div>
        </section>

        {/* ── SOLUTION: 5D MACHINE ── */}
        <section className="mkt-section mkt-zig">
          <div className="container mkt-zig__grid">
            <div className="mkt-zig__copy">
              <p className="mkt-eyebrow">The solution</p>
              <h2 className="mkt-h2">The 5D Machine</h2>
              <p className="mkt-body">
                A step by step course that takes your company from where it is
                now to a profit focused machine. Thirty segments, each with a
                plain explanation, a task list your team actually does, and
                short audio and video to back it up. It works for a one person
                shop and a thousand person company alike.
              </p>
              <Link href="/5d-machine" className="mkt-textlink">
                See all 30 segments
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>
            <div className="mkt-zig__art" aria-hidden="true">
              <div className="mock mock--grid">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className={`mock-tile${i === 2 ? ' is-active' : ''}`}>
                    <span className="mock-tile__n">{String(i + 1).padStart(2, '0')}</span>
                    <span className="mock-tile__bar" />
                    <span className="mock-tile__bar mock-tile__bar--short" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── ORG / TEAMS ── */}
        <section className="mkt-section mkt-zig mkt-zig--rev">
          <div className="container mkt-zig__grid">
            <div className="mkt-zig__art" aria-hidden="true">
              <div className="mock mock--teams">
                <div className="mock__bar"><span /><span /><span /></div>
                <div className="mock__body">
                  <div className="mock-teams__chips">
                    <span className="mock-chip is-on">Executive</span>
                    <span className="mock-chip">Managers</span>
                    <span className="mock-chip">HR</span>
                    <span className="mock-chip">Accounting</span>
                  </div>
                  <div className="mock-teams__rows">
                    <div className="mock-mem">
                      <span className="mock-ava" />
                      <span className="mock-mem__name" />
                      <span className="mock-pill">8 assigned</span>
                    </div>
                    <div className="mock-mem">
                      <span className="mock-ava" />
                      <span className="mock-mem__name" />
                      <span className="mock-pill">Done</span>
                    </div>
                    <div className="mock-mem">
                      <span className="mock-ava" />
                      <span className="mock-mem__name" />
                      <span className="mock-pill">5 assigned</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mkt-zig__copy">
              <p className="mkt-eyebrow">For organizations</p>
              <h2 className="mkt-h2">Run the program across your whole company.</h2>
              <p className="mkt-body">
                Create your organization, invite your whole team with a single
                code, and build teams that match how you actually work. Assign
                the right segments to the right people, then watch completion
                roll in. Everyone gets the full program. You get the full
                picture.
              </p>
            </div>
          </div>
        </section>

        {/* ── BONUS CONTENT (divided list, not cards) ── */}
        <section className="mkt-section mkt-bonus">
          <div className="container">
            <div className="mkt-split">
              <div className="mkt-split__lead">
                <p className="mkt-eyebrow">Beyond the machine</p>
                <h2 className="mkt-h2">Content that keeps your team coming back.</h2>
              </div>
              <p className="mkt-body mkt-split__aside">
                The 5D Machine is the heart of the program. The rest is what
                makes it a habit. Short, sharp business content your people
                actually want to watch and hear.
              </p>
            </div>

            <ul className="mkt-bonus__list">
              <li>
                <span className="mkt-bonus__name">MBA Seminars</span>
                <span className="mkt-bonus__desc">
                  The flagship seminar, available in four lengths so leaders can
                  assign the right depth to the right team.
                </span>
              </li>
              <li>
                <span className="mkt-bonus__name">Employee Opportunity Seminars</span>
                <span className="mkt-bonus__desc">
                  Short videos that open doors for every employee, whatever their
                  role.
                </span>
              </li>
              <li>
                <span className="mkt-bonus__name">Business in Five Dimensions</span>
                <span className="mkt-bonus__desc">
                  The thinking behind the framework, taught in plain language
                  anyone on your team can follow.
                </span>
              </li>
              <li>
                <span className="mkt-bonus__name">Pod of the Day</span>
                <span className="mkt-bonus__desc">
                  A short daily pod of business stories and lessons, built to be
                  a habit on the drive in.
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* ── CTA BAND ── */}
        <section className="mkt-cta">
          <div className="container mkt-cta__inner">
            <h2 className="mkt-cta__title">
              Your company is one decision away from a profit focus.
            </h2>
            <p className="mkt-cta__sub">
              Start free as an individual, or bring your whole team when you are
              ready.
            </p>
            <Link href="/signup" className="btn btn--white btn--lg">
              Sign Up Now
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </>
  )
}
