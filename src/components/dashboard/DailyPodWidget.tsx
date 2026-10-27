import type { PotdEpisodeStub } from '@/lib/content-queries'
import { PotdPlayButton } from '@/components/potd/PotdPlayButton'

/**
 * Daily Pod card on the dashboard (sits beside "This week").
 *
 * POTD is bonus content, available to everyone (no org launch, no daily
 * drip). Surfaces the member's next unheard episode — or the latest one if
 * they're caught up — with a one-click Listen/Replay into the persistent
 * player. Renders nothing when there are no published episodes.
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

  return (
    <section className="dash-card dash-pod" aria-labelledby="dash-pod-h">
      <div className="dash-card__head">
        <h2 id="dash-pod-h" className="dash-card__title">
          {done ? 'Daily Pod · caught up' : 'Today’s Daily Pod'}
        </h2>
        {episode.duration_mins != null && (
          <span className="dash-pod__len">{episode.duration_mins} min</span>
        )}
      </div>
      <p className="dash-pod__episode">{itemTitle}</p>
      <p className="dash-card__text">
        {done
          ? 'You’ve heard every episode — replay the latest any time.'
          : 'A quick business story to start your day.'}
      </p>
      <PotdPlayButton
        itemId={episode.id}
        episodeNum={episode.sequence_num}
        title={itemTitle}
        mediaUrl={episode.media_url}
        className="dash-pod__cta"
        idleLabel={done ? 'Replay' : 'Listen'}
      />
    </section>
  )
}
