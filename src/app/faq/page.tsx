import Link from 'next/link'
import type { Metadata } from 'next'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'

export const metadata: Metadata = {
  title: 'FAQ | Umbrella',
  description:
    'Answers to common questions about the Umbrella Program, the 5D Machine, teams, and getting started.',
}

const FAQS: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: 'What is the Umbrella Program?',
    a: 'Umbrella is a platform that trains everyone in a company to work toward one goal: profit. The core of it is a step by step system called the 5D Machine, backed by short business content that keeps your team engaged along the way.',
  },
  {
    q: 'What is the 5D Machine?',
    a: 'It is a guided course of thirty segments that walk your company from where it is now to a profit focused company. Each segment gives you a plain explanation, a task list to act on, and short audio and video. You do the steps, and your business changes as you go.',
  },
  {
    q: 'Who is this actually for?',
    a: 'Any organization that wants to grow profit, and every person inside it. It is written so an executive and a part time employee can both follow it and both contribute. It works for a small shop, a large company, and nonprofits too.',
  },
  {
    q: 'Do I need a whole company to use it?',
    a: 'No. You can sign up as an individual and work the program on your own. When you are ready, you can create an organization or join one with an invite code. Nothing is locked behind a company account.',
  },
  {
    q: 'Can I run the program across my whole team?',
    a: 'Yes. Create your organization, invite your people with a single code, and build teams that match how you work. You can assign the right segments to the right teams and track who has completed what, while everyone still has access to the full program.',
  },
  {
    q: 'What is the bonus content?',
    a: 'Alongside the 5D Machine you get the Business Success Seminars, Employee Opportunity Seminars, Business in Five Dimensions, and Pod of the Day. It is short, sharp business content that teaches the fundamentals and keeps your team coming back.',
  },
  {
    q: 'How long does it take?',
    a: 'You move at your own pace. Some teams run a segment a week, others move faster. Because every segment ends in real action, you start to feel the effect well before you reach the end.',
  },
  {
    q: 'How much does it cost?',
    a: 'You can start for free. Plans for organizations that want to roll the program out across teams are flexible and based on the size of your company. Reach out and we will find the right fit.',
  },
  {
    q: 'Is my company data private?',
    a: 'Your progress and your team data belong to you. Members only see their own work, and managers only see their own organization. We do not share your information across companies.',
  },
  {
    q: 'How do I get started?',
    a: 'Create an account, choose whether you are an individual or representing an organization, and start the first segment. It takes about a minute.',
  },
]

export default function FaqPage() {
  return (
    <>
      <MarketingNav active="faq" />

      <main>
        <section className="mkt-hero mkt-hero--page mkt-hero--short">
          <div className="mkt-hero__glow" aria-hidden="true" />
          <div className="container">
            <p className="mkt-eyebrow"></p>
            <h1 className="mkt-hero__title mkt-hero__title--page">
              Frequently Asked, <span className="mkt-grad">Questions</span>.
            </h1>
            <p className="mkt-hero__sub mkt-hero__sub--wide">
              Everything you might want to know before you start. Still stuck?
              Reach us at{' '}
              <a href="mailto:hello@bz5d.com" className="mkt-inlinelink">
                hello@bz5d.com
              </a>
              .
            </p>
          </div>
        </section>

        <section className="mkt-section mkt-faq">
          <div className="container mkt-faq__inner">
            {FAQS.map((item, i) => (
              <details key={i} className="mkt-faq__item">
                <summary className="mkt-faq__q">
                  <span>{item.q}</span>
                  <svg className="mkt-faq__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>
                <p className="mkt-faq__a">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mkt-cta">
          <div className="container mkt-cta__inner">
            <h2 className="mkt-cta__title">Ready when you are.</h2>
            <p className="mkt-cta__sub">Start free and see the first segment for yourself.</p>
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
