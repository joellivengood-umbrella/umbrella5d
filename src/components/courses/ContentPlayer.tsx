import { LessonAudioPlayer } from './LessonAudioPlayer'
import { VideoContent } from './VideoContent'

/**
 * Renders the appropriate media player for a content item, or a
 * "coming soon" placeholder if media_url is null.
 *
 * Detection rules:
 *   - media_url ends in .mp3/.wav/.m4a/.ogg/.aac       → LessonAudioPlayer
 *   - media_url ends in .mp4/.webm/.mov                → our VideoPlayer
 *   (Vimeo / YouTube links are not supported: our player must control
 *   playback to enforce "no skipping ahead" and the 90%-watched rule.)
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
  sourceId = null,
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
  /**
   * The content_items / lesson_blocks id this media belongs to. For video,
   * it saves watch progress and drives the "watch 90% to complete" gate.
   */
  sourceId?: string | null
}) {
  if (!mediaUrl) {
    return <ComingSoonPlaceholder mediaKind={mediaKind} />
  }

  const url = mediaUrl.trim()

  // Native audio — designed inline player, themed from the lesson's colour.
  if (/\.(mp3|wav|m4a|ogg|aac)(\?|$)/i.test(url)) {
    return <LessonAudioPlayer src={url} title={title} bumperEligible={bumperEligible} />
  }

  // Native video
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
    return (
      <VideoContent
        mediaUrl={url}
        title={title}
        sourceId={sourceId}
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
