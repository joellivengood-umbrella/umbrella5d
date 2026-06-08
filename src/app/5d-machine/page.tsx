import Link from 'next/link'
import type { Metadata } from 'next'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { MachineGrid } from '@/components/marketing/MachineGrid'
import { FragmentGraphic } from '@/components/marketing/FragmentGraphic'

export const metadata: Metadata = {
  title: 'The 5D Machine | Umbrella',
  description:
    'Thirty guided segments across the five dimensions of your business. Each one has a plain explanation, a task list, and short audio and video. A clear path from fragmentation, to profit focus.',
}

export default function MachinePage() {
  return (
    <>
      <MarketingNav active="machine" />

      <main>
        {/* ── TOP HERO: centered statement over a box-grid texture ── */}
        <section className="mkt-tophero">
          <svg className="mkt-tophero__grid" aria-hidden="true" width="100%" height="100%">
            <defs>
              <pattern id="boxGrid" x="0" y="0" width="72" height="72" patternUnits="userSpaceOnUse">
                <rect x="8" y="8" width="56" height="56" rx="14" fill="none" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#boxGrid)" />
          </svg>
          <div className="container mkt-tophero__inner">
            <h1 className="mkt-tophero__title">
              The 5D Machine is a step by step procedural process to turn your
              business into a <span className="mkt-grad">profit machine</span>.
            </h1>
          </div>
        </section>

        {/* ── HERO ── */}
        <section className="mkt-hero mkt-hero--page mkt-hero--stacked">
          <div className="mkt-hero__glow" aria-hidden="true" />
          <div className="container mkt-hero__grid">
            <div className="mkt-hero__copy">
              <p className="mkt-eyebrow">The 5D Machine</p>
              <h2 className="mkt-hero__title">
                A clear path<br />
                from fragmentation,<br />
                to <span className="mkt-grad">profit focus</span>.
              </h2>
              <p className="mkt-hero__sub mkt-hero__sub--wide">
                The 5D Machine is the heart of the Umbrella Program. Thirty
                segments, grouped into the five dimensions of your business.
                You do not need a strategy degree or a consultant. You follow
                the steps, do the work, and your company changes underneath
                you.
              </p>
              <div className="mkt-hero__actions">
                <Link href="/signup" className="btn btn--primary btn--lg">
                  Sign Up Now
                </Link>
              </div>
            </div>
            <div className="mkt-hero__art mkt-hero__art--frag" aria-hidden="true">
              <FragmentGraphic />
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
                    <span className="mock-seg__play">
                      <svg viewBox="0 0 24 24" fill="#fff" width="11" height="11" aria-hidden="true">
                        <polygon points="7 5 19 12 7 19 7 5" />
                      </svg>
                    </span>
                    <span className="mock-seg__track">
                      <span className="mock-seg__fill" />
                    </span>
                    <span className="mock-seg__time" />
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
