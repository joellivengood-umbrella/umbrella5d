/**
 * Renders the appropriate media player for a content item, or a
 * "coming soon" placeholder if media_url is null.
 *
 * Detection rules:
 *   - media_url contains 'vimeo.com' or 'player.vimeo' → Vimeo iframe
 *   - media_url contains 'youtube.com' or 'youtu.be'    → YouTube iframe
 *   - media_url ends in .mp3/.wav/.m4a/.ogg            → <audio>
 *   - media_url ends in .mp4/.webm/.mov                → <video>
 *   - otherwise (or null)                              → placeholder
 *
 * `mediaKind` ("video" | "audio") is used to choose the placeholder
 * icon when there's no media_url yet.
 */
export function ContentPlayer({
  mediaUrl,
  mediaKind,
  title,
}: {
  mediaUrl: string | null
  mediaKind: 'video' | 'audio'
  title: string
}) {
  if (!mediaUrl) {
    return <ComingSoonPlaceholder mediaKind={mediaKind} />
  }

  const url = mediaUrl.trim()
  const lower = url.toLowerCase()

  // Vimeo
  if (lower.includes('vimeo.com') || lower.includes('player.vimeo')) {
    const embedUrl = lower.includes('player.vimeo')
      ? url
      : // Convert vimeo.com/123 → player.vimeo.com/video/123
        url.replace(
          /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/,
          'https://player.vimeo.com/video/$1'
        )
    return (
      <div className="lesson-video-wrap">
        <div className="video-wrapper">
          <iframe
            src={embedUrl}
            title={title}
            frameBorder={0}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    )
  }

  // YouTube
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    const idMatch = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([A-Za-z0-9_-]{6,})/
    )
    const videoId = idMatch?.[1]
    if (videoId) {
      return (
        <div className="lesson-video-wrap">
          <div className="video-wrapper">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title={title}
              frameBorder={0}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )
    }
  }

  // Native audio
  if (/\.(mp3|wav|m4a|ogg|aac)(\?|$)/i.test(url)) {
    return (
      <div className="audio-player-wrap">
        <audio controls src={url} preload="metadata" style={{ width: '100%' }}>
          Your browser doesn&apos;t support the audio element.
        </audio>
      </div>
    )
  }

  // Native video
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
    return (
      <div className="lesson-video-wrap">
        <div className="video-wrapper">
          <video controls src={url} preload="metadata" style={{ width: '100%' }}>
            Your browser doesn&apos;t support the video element.
          </video>
        </div>
      </div>
    )
  }

  // Unknown URL shape — fall back to placeholder.
  return <ComingSoonPlaceholder mediaKind={mediaKind} />
}

function ComingSoonPlaceholder({ mediaKind }: { mediaKind: 'video' | 'audio' }) {
  return (
    <div className="lesson-placeholder">
      {mediaKind === 'audio' ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          width="48"
          height="48"
          aria-hidden="true"
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          width="48"
          height="48"
          aria-hidden="true"
        >
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      )}
      <p>Content coming soon.</p>
      <p className="lesson-placeholder-sub">
        Check back as the program rolls out.
      </p>
    </div>
  )
}
