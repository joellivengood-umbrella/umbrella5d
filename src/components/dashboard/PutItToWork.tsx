import Link from 'next/link'
import type { LatestAnswer } from '@/lib/dashboard-queries'

/**
 * "Put it to work this week": the member's own most recent 5D Machine
 * activity answer, handed back with one small step to act on it — so the
 * dashboard turns learning into doing, not just a progress bar.
 */
export function PutItToWork({ answer }: { answer: LatestAnswer }) {
  const lessonLabel = [answer.address, answer.lessonTitle].filter(Boolean).join(' · ')
  return (
    <section className="dash-card applyit" aria-labelledby="applyit-h">
      <div className="dash-card__head">
        <h2 id="applyit-h" className="dash-card__title">
          Put it to work this week
        </h2>
        {lessonLabel && <span className="dash-card__aside">From {lessonLabel}</span>}
      </div>
      {answer.prompt && <p className="applyit__prompt">{answer.prompt}</p>}
      <blockquote className="applyit__answer">{answer.answer}</blockquote>
      <p className="dash-card__text">
        <strong>One step:</strong> act on this once before the week is out — and share it with
        someone on your team.
      </p>
      <Link href={`/courses/machine/${answer.lessonSequenceNum}`} className="dash-card__link">
        Revisit the lesson
      </Link>
    </section>
  )
}
