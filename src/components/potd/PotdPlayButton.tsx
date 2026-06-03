'use client'

import { usePotdPlayer } from './PotdPlayerProvider'

/**
 * Button that loads a POTD episode into the global player. Reflects
 * live player state: shows Pause when this episode is the one currently
 * playing, Resume when it's loaded but paused, and the idle label
 * otherwise.
 *
 * Used in two places: the dashboard's Today's Pod widget and the POTD
 * episode detail page. Styling is driven entirely by `className` so
 * each caller can size/theme it.
 *
 * If the episode has no media_url yet, renders a disabled "Coming soon"
 * button rather than a broken play action.
 */
export function PotdPlayButton({
  itemId,
  episodeNum,
  title,
  mediaUrl,
  className = '',
  idleLabel = 'Listen',
}: {
  itemId: string
  episodeNum: number
  title: string
  mediaUrl: string | null
  className?: string
  idleLabel?: string
}) {
  const { current, isPlaying, play, toggle } = usePotdPlayer()

  if (!mediaUrl) {
    return (
      <button type="button" className={className} disabled>
        Coming soon
      </button>
    )
  }

  const isCurrent = current?.itemId === itemId
  const showPause = isCurrent && isPlaying

  function handleClick() {
    if (isCurrent) {
      toggle()
    } else {
      play({ itemId, episodeNum, title, mediaUrl: mediaUrl as string })
    }
  }

  const label = showPause ? 'Pause' : isCurrent ? 'Resume' : idleLabel

  return (
    <button type="button" className={className} onClick={handleClick}>
      {showPause ? (
        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
          <polygon points="6 4 20 12 6 20 6 4" />
        </svg>
      )}
      <span>{label}</span>
    </button>
  )
}
