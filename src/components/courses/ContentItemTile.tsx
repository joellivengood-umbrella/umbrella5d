import Link from 'next/link'

/**
 * Small square-ish tile used in content-item lists (EOS videos, POTD
 * episodes, Machine segments, BSS segments). Shows a number, a short
 * title, a done/locked badge, and optional duration.
 */
export function ContentItemTile({
  href,
  number,
  title,
  durationMins,
  done = false,
  locked = false,
  lockedLabel,
}: {
  href: string
  number: number
  title: string
  durationMins?: number | null
  done?: boolean
  locked?: boolean
  lockedLabel?: string
}) {
  const className = [
    'content-tile',
    done ? 'is-done' : '',
    locked ? 'is-locked' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const body = (
    <>
      <div className="content-tile__number">
        {locked ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="18"
            height="18"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        ) : done ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="18"
            height="18"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          number
        )}
      </div>
      <div className="content-tile__body">
        <div className="content-tile__title">{title}</div>
        {durationMins ? (
          <div className="content-tile__meta">{durationMins} min</div>
        ) : locked && lockedLabel ? (
          <div className="content-tile__meta">{lockedLabel}</div>
        ) : null}
      </div>
    </>
  )

  if (locked) {
    return (
      <div className={className} aria-disabled="true">
        {body}
      </div>
    )
  }

  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  )
}
