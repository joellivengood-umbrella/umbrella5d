import type { PotdEpisodeStub } from '@/lib/content-queries'
import { PotdPlayButton } from '@/components/potd/PotdPlayButton'

/**
 * Daily Pod widget on the dashboard.
 *
 * POTD is bonus content, available to everyone (no org launch, no
 * daily drip). This widget surfaces the user's next unheard episode —
 * or the latest one if they're caught up — with a one-click
 * Listen/Replay into the persistent player.
 *
 * Renders nothing when there are no published episodes.
 */
export function DailyPodWidget({
  episode,
  done,
}: {
  episode: PotdEpisodeStub | null
  done: boolean
}) {
  if (!episode) return null

  const itemTitle = episode.title ?? `Episode ${episode.sequence_num}`
  const durationLabel =
    episode.duration_mins != null
      ? `${episode.duration_mins} min · Bonus`
      : 'Bonus'

  return (
    <section className={`today-pod${done ? ' today-pod--done' : ''}`}>
      <div className="today-pod__body">
        <div className="today-pod__icon" aria-hidden="true">
          {done ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </div>
        <div className="today-pod__copy">
          <p className="today-pod__eyebrow">
            {done ? 'Daily Pod · Caught up' : 'Daily Pod · Bonus'}
          </p>
          <p className="today-pod__title">
            Episode {episode.sequence_num} — {itemTitle}
          </p>
          <p className="today-pod__meta">{durationLabel}</p>
        </div>
      </div>
      <PotdPlayButton
        itemId={episode.id}
        episodeNum={episode.sequence_num}
        title={itemTitle}
        mediaUrl={episode.media_url}
        className="today-pod__cta"
        idleLabel={done ? 'Replay' : 'Listen'}
      />
    </section>
  )
}
