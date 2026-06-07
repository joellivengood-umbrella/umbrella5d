import Link from 'next/link'
import type { Metadata } from 'next'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { MachineGrid } from '@/components/marketing/MachineGrid'

export const metadata: Metadata = {
  title: 'The 5D Machine | Umbrella',
  description:
    'Thirty guided segments across the five dimensions of your business. Each one has a plain explanation, a task list, and short audio and video. A clear path from where you are to a profit focused company.',
}

export default function MachinePage() {
  return (
    <>
      <MarketingNav active="machine" />

      <main>
        {/* ── HERO ── */}
        <section className="mkt-hero mkt-hero--page">
          <div className="mkt-hero__glow" aria-hidden="true" />
          <div className="container">
            <p className="mkt-eyebrow">The 5D Machine</p>
            <h1 className="mkt-hero__title mkt-hero__title--page">
              A clear path from where you are to a{' '}
              <span className="mkt-grad">profit focused</span> company.
            </h1>
            <p className="mkt-hero__sub mkt-hero__sub--wide">
              The 5D Machine is the heart of the Umbrella Program. Thirty
              segments, grouped into the five dimensions of your business. You
              do not need a strategy degree or a consultant. You follow the
              steps, do the work, and your company changes underneath you.
            </p>
            <div className="mkt-hero__actions">
              <Link href="/signup" className="btn btn--primary btn--lg">
                Sign Up Now
              </Link>
            </div>
          </div>
        </section>

        {/* ── HOW A SEGMENT WORKS ── */}
        <section className="mkt-section mkt-zig">
          <div className="container mkt-zig__grid">
            <div className="mkt-zig__copy">
              <p className="mkt-eyebrow">Inside every segment</p>
              <h2 className="mkt-h2">Three parts. Built to be done, not just watched.</h2>
              <ul className="mkt-steplist">
                <li>
                  <span className="mkt-steplist__k">Explanation</span>
                  <span className="mkt-steplist__v">
                    A plain, short read on what this step is and why it moves
                    profit.
                  </span>
                </li>
                <li>
                  <span className="mkt-steplist__k">Task list</span>
                  <span className="mkt-steplist__v">
                    The exact actions to take in your business this week. Check
                    them off as you go.
                  </span>
                </li>
                <li>
                  <span className="mkt-steplist__k">Audio and video</span>
                  <span className="mkt-steplist__v">
                    Short supporting content with real examples, so the idea
                    actually sticks.
                  </span>
                </li>
              </ul>
            </div>
            <div className="mkt-zig__art" aria-hidden="true">
              <div className="mock mock--segment">
                <div className="mock__bar"><span /><span /><span /></div>
                <div className="mock__body">
                  <span className="mock-tag">Segment 03</span>
                  <div className="mock-seg__title" />
                  <div className="mock-seg__line" />
                  <div className="mock-seg__line" />
                  <div className="mock-seg__line mock-seg__line--short" />
                  <div className="mock-seg__tasks">
                    <span className="mock-task is-on" />
                    <span className="mock-task is-on" />
                    <span className="mock-task" />
                    <span className="mock-task" />
                  </div>
                  <div className="mock-seg__player">
                    <span className="mock-seg__play" />
                    <span className="mock-seg__track" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── THE FULL GRID ── */}
        <section className="mkt-section mkt-grid-section">
          <div className="container">
            <div className="mkt-split">
              <div className="mkt-split__lead">
                <p className="mkt-eyebrow">The whole machine</p>
                <h2 className="mkt-h2">Thirty segments. Five dimensions.</h2>
              </div>
              <p className="mkt-body mkt-split__aside">
                Start at the core of your business and work outward. Every
                segment builds on the last, so by the end you have not just
                learned something, you have changed your company.
              </p>
            </div>

            <MachineGrid />
          </div>
        </section>

        {/* ── CTA BAND ── */}
        <section className="mkt-cta">
          <div className="container mkt-cta__inner">
            <h2 className="mkt-cta__title">Start the machine.</h2>
            <p className="mkt-cta__sub">
              The first segment is free. So is the next one.
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
