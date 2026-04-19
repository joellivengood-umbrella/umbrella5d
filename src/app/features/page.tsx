import Link from 'next/link'
import type { Metadata } from 'next'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'

export const metadata: Metadata = {
  title: 'The Program',
  description:
    'Nothing like the Umbrella Program exists anywhere in the world. A detailed, step-by-step transformation built on the irrefutable laws of the business universe.',
}

export default function FeaturesPage() {
  return (
    <>
      <MarketingNav active="features" />

      <main>
        {/* ── PAGE HERO ── */}
        <section className="page-hero">
          <div className="page-hero__inner">
            <p className="section-eyebrow">The Umbrella Program</p>
            <h1 className="page-hero__title">
              One program.<br />Every dimension of your business.
            </h1>
            <p className="page-hero__sub">
              Nothing like the Umbrella Program exists anywhere in the world. A
              detailed, step-by-step transformation built on the irrefutable
              laws of the business universe.
            </p>
          </div>
        </section>

        {/* ── FEATURES OVERVIEW GRID (6 cards) ── */}
        <section className="features-overview">
          <div className="container">
            <div className="section-header">
              <p className="section-eyebrow">What&rsquo;s included</p>
              <h2 className="section-title">Five Pillars. One program.</h2>
              <p className="section-sub">
                From CEO to maintenance worker &mdash; every seminar, every
                tool, every instruction is designed to be easy to understand
                and even easier to implement.
              </p>
            </div>

            <div className="features-grid-lg">
              {/* Card 1 */}
              <div className="feature-card-lg">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="7" r="4" />
                    <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
                  </svg>
                </div>
                <h3>The Five Dimensions Framework</h3>
                <p>
                  Your product is just one of five dimensions your customers
                  care about &mdash; and it&rsquo;s rarely the most important
                  one. The Umbrella Program teaches your entire business to
                  compete across all five.
                </p>
              </div>

              {/* Card 2 */}
              <div className="feature-card-lg">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                </div>
                <h3>Multimedia Seminars</h3>
                <p>
                  A diverse array of seminars for every person in your
                  organisation &mdash; from CEO to maintenance worker &mdash;
                  building the conceptual foundation before any action is
                  taken.
                </p>
              </div>

              {/* Card 3 */}
              <div className="feature-card-lg">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <h3>The Umbrella Machine</h3>
                <p>
                  The cloud-based action layer. 32 instruction sets that
                  translate seminar learning into measurable business
                  transformation, step by step, over six weeks.
                </p>
              </div>

              {/* Card 4 */}
              <div className="feature-card-lg">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </div>
                <h3>Prerequisites &amp; Context</h3>
                <p>
                  Every instruction set begins with prerequisites &mdash; audio
                  or video from business history showing exactly what companies
                  like yours have done in this precise situation.
                </p>
              </div>

              {/* Card 5 */}
              <div className="feature-card-lg">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <h3>Precise Objectives</h3>
                <p>
                  Before each instruction, you receive a concise objective
                  &mdash; what you&rsquo;re doing and why. No ambiguity, no
                  guesswork. Just clear purpose before every action.
                </p>
              </div>

              {/* Card 6 */}
              <div className="feature-card-lg">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <h3>Revenue. Profits. Glory.</h3>
                <p>
                  The Umbrella Program does one thing and one thing only: it
                  significantly enhances and maximises profits. Nothing like it
                  exists anywhere else in the world.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── DEEP DIVE 1 — Core Theory ── */}
        <section className="deep-dive deep-dive--alt">
          <div className="container">
            <div className="deep-dive__grid">
              <div className="deep-dive__content">
                <p className="section-eyebrow">The Core Theory</p>
                <h2>The customer paradigm has shifted.</h2>
                <p>
                  Customers no longer want a narrow product. They want complete
                  and total benefit &mdash; everything, from one source, on
                  their terms. Your product is just one of five dimensions they
                  care about. The businesses that understand all five will
                  dominate. Those that don&rsquo;t will be left behind.
                </p>
                <ul className="feature-list">
                  <li>There are irrefutable laws that govern the business universe</li>
                  <li>Customers want complete and total benefit &mdash; not just a product</li>
                  <li>Your product is rarely the most important dimension</li>
                  <li>Business in five dimensions is the future of capitalism</li>
                </ul>
              </div>

              <div className="deep-dive__visual">
                <div className="feature-mockup">
                  <div className="mockup-chrome">
                    <span className="mockup-dot mockup-dot--r" />
                    <span className="mockup-dot mockup-dot--y" />
                    <span className="mockup-dot mockup-dot--g" />
                  </div>
                  <div className="mockup-body">
                    <div className="chat-messages">
                      <div className="chat-msg chat-msg--left">
                        <div className="chat-avatar" style={{ background: 'linear-gradient(135deg,#818cf8,#5b4fff)' }} />
                        <div className="chat-bubble">
                          <div className="chat-line" style={{ width: '85%' }} />
                          <div className="chat-line chat-line--short" />
                        </div>
                      </div>

                      <div className="chat-msg chat-msg--right">
                        <div className="chat-avatar" style={{ background: 'linear-gradient(135deg,#34d399,#059669)' }} />
                        <div className="chat-bubble">
                          <div className="chat-line" style={{ width: '70%' }} />
                          <div className="chat-line" style={{ width: '90%' }} />
                          <div className="chat-line chat-line--short" />
                        </div>
                      </div>

                      <div className="chat-msg chat-msg--left">
                        <div className="chat-avatar" style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }} />
                        <div className="chat-bubble">
                          <div className="chat-line" style={{ width: '80%' }} />
                        </div>
                      </div>

                      <div className="chat-msg chat-msg--right">
                        <div className="chat-avatar" style={{ background: 'linear-gradient(135deg,#fbbf24,#d97706)' }} />
                        <div className="chat-bubble">
                          <div className="chat-line" style={{ width: '55%' }} />
                          <div className="chat-line" style={{ width: '75%' }} />
                        </div>
                      </div>

                      <div className="chat-msg chat-msg--left">
                        <div className="chat-avatar" style={{ background: 'linear-gradient(135deg,#818cf8,#5b4fff)' }} />
                        <div className="chat-typing">
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── DEEP DIVE 2 — The 32-Step Machine ── */}
        <section className="deep-dive deep-dive--reverse">
          <div className="container">
            <div className="deep-dive__grid">
              <div className="deep-dive__content">
                <p className="section-eyebrow">The 32-Step Machine</p>
                <h2>A precise, step-by-step procedure for any business.</h2>
                <p>
                  The Umbrella Machine is a cloud-based tool that guides you
                  through 32 specific instruction sets, typically completed
                  over six weeks. It works for every type and size of business
                  &mdash; from a tech startup to an established steel mill.
                  Nothing like it exists anywhere else in the world.
                </p>
                <ul className="feature-list">
                  <li>32 precise instruction sets, completed over ~6 weeks</li>
                  <li>Works for any business type and size</li>
                  <li>Each step: prerequisites, then objectives, then action</li>
                  <li>Expert guidance at every stage &mdash; guide at your side</li>
                </ul>
              </div>

              <div className="deep-dive__visual">
                <div className="feature-mockup">
                  <div className="mockup-chrome">
                    <span className="mockup-dot mockup-dot--r" />
                    <span className="mockup-dot mockup-dot--y" />
                    <span className="mockup-dot mockup-dot--g" />
                  </div>
                  <div className="mockup-body">
                    <div className="pipeline-row">
                      <div className="pipeline-node pipeline-node--done">&#9654; Trigger</div>
                      <span className="pipeline-arrow">&rarr;</span>
                      <div className="pipeline-node pipeline-node--done">Filter</div>
                      <span className="pipeline-arrow">&rarr;</span>
                      <div className="pipeline-node pipeline-node--done">Transform</div>
                      <span className="pipeline-arrow">&rarr;</span>
                      <div className="pipeline-node">Notify</div>
                    </div>

                    <div className="pipeline-stats">
                      <div className="pipeline-stat">
                        <div className="pipeline-stat__val">32</div>
                        <div className="pipeline-stat__label">Instruction Sets</div>
                      </div>
                      <div className="pipeline-stat">
                        <div className="pipeline-stat__val">6-Week</div>
                        <div className="pipeline-stat__label">Program</div>
                      </div>
                      <div className="pipeline-stat">
                        <div className="pipeline-stat__val">Any Size</div>
                        <div className="pipeline-stat__label">Any Business</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── DEEP DIVE 3 — The Seminar Program ── */}
        <section className="deep-dive deep-dive--alt">
          <div className="container">
            <div className="deep-dive__grid">
              <div className="deep-dive__content">
                <p className="section-eyebrow">The Seminar Program</p>
                <h2>Built for every person in your organisation.</h2>
                <p>
                  The Umbrella Program begins with a diverse array of
                  multimedia seminars &mdash; designed for every individual
                  from CEO to maintenance worker. These seminars build the
                  conceptual understanding that makes every subsequent action
                  not just executable, but inevitable.
                </p>
                <ul className="feature-list">
                  <li>Multimedia content designed for every role</li>
                  <li>Business history examples that bring theory to life</li>
                  <li>Conceptual foundation before practical action</li>
                  <li>Easy to understand, even easier to implement</li>
                </ul>
              </div>

              <div className="deep-dive__visual">
                <div className="feature-mockup">
                  <div className="mockup-chrome">
                    <span className="mockup-dot mockup-dot--r" />
                    <span className="mockup-dot mockup-dot--y" />
                    <span className="mockup-dot mockup-dot--g" />
                  </div>
                  <div className="mockup-body">
                    <div className="chart-bars">
                      <div className="chart-bar" style={{ height: '45%' }} />
                      <div className="chart-bar--mid chart-bar" style={{ height: '60%' }} />
                      <div className="chart-bar" style={{ height: '38%' }} />
                      <div className="chart-bar--mid chart-bar" style={{ height: '72%' }} />
                      <div className="chart-bar--accent chart-bar" style={{ height: '88%' }} />
                      <div className="chart-bar--mid chart-bar" style={{ height: '65%' }} />
                      <div className="chart-bar" style={{ height: '55%' }} />
                    </div>
                    <div className="chart-legend">
                      <div className="legend-item">
                        <span className="legend-dot" style={{ background: 'rgba(91,79,255,.8)' }} />
                        Revenue growth
                      </div>
                      <div className="legend-item">
                        <span className="legend-dot" style={{ background: 'rgba(91,79,255,.4)' }} />
                        Profit increase
                      </div>
                      <div className="legend-item">
                        <span className="legend-dot" style={{ background: 'rgba(91,79,255,.2)' }} />
                        Businesses transformed
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA BAND ── */}
        <section className="cta-band">
          <div className="container">
            <h2>Ready to see what five dimensions can do?</h2>
            <p>
              The only program of its kind, anywhere in the world. It&rsquo;s
              time to stop waiting and start profiting.
            </p>
            <Link href="/login" className="btn btn--white btn--lg">
              Get started &mdash; it&rsquo;s free
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </>
  )
}
