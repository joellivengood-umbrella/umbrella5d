import { LessonAudioPlayer } from './LessonAudioPlayer'
import { VideoContent } from './VideoContent'

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
  bumperEligible = false,
}: {
  mediaUrl: string | null
  mediaKind: 'video' | 'audio'
  title: string
  /**
   * Whether a partner "Brought to you by …" pre-roll may play before this
   * content. False for 5D Machine (and the default, so a caller that forgets
   * never leaks a bumper). Applies to both audio and video.
   */
  bumperEligible?: boolean
}) {
  if (!mediaUrl) {
    return <ComingSoonPlaceholder mediaKind={mediaKind} />
  }

  const url = mediaUrl.trim()
  const lower = url.toLowerCase()

  // Vimeo — VideoContent renders the embed + optional pre-roll on the client.
  if (lower.includes('vimeo.com') || lower.includes('player.vimeo')) {
    const embedUrl = lower.includes('player.vimeo')
      ? url
      : // Convert vimeo.com/123 → player.vimeo.com/video/123
        url.replace(
          /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/,
          'https://player.vimeo.com/video/$1'
        )
    return (
      <VideoContent
        kind="vimeo"
        embedUrl={embedUrl}
        mediaUrl={url}
        title={title}
        bumperEligible={bumperEligible}
      />
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
        <VideoContent
          kind="youtube"
          embedUrl={`https://www.youtube.com/embed/${videoId}`}
          mediaUrl={url}
          title={title}
          bumperEligible={bumperEligible}
        />
      )
    }
  }

  // Native audio — designed inline player, themed from the lesson's colour.
  if (/\.(mp3|wav|m4a|ogg|aac)(\?|$)/i.test(url)) {
    return <LessonAudioPlayer src={url} title={title} bumperEligible={bumperEligible} />
  }

  // Native video
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
    return (
      <VideoContent
        kind="native"
        mediaUrl={url}
        title={title}
        bumperEligible={bumperEligible}
      />
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
