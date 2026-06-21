'use client'

import { useEffect, useRef, useState } from 'react'
import { usePartnerBumper } from '@/components/app/PartnerBumperContext'

/**
 * Video player with an optional partner pre-roll. ContentPlayer (a server
 * component) classifies the URL and hands us the kind + embed URL; we render
 * the actual player here on the client so we can gate it behind the partner's
 * "Brought to you by …" bumper.
 *
 * The bumper is an AUDIO clip, so for video we play it over a branded card that
 * overlays the 16:9 area — one mechanism that works for native <video>, Vimeo,
 * and YouTube alike (we never reach into the iframe). Flow:
 *   gate    → branded card with a Play button (the required user gesture)
 *   bumper  → card stays, the audio clip plays
 *   playing → card gone, the real player is mounted with autoplay
 *
 * A failed/hung bumper falls through to the player (catch + safety timeout).
 * Members with no eligible bumper get the player straight away, unchanged —
 * including autoplay:false so native controls behave exactly as before.
 */
type VideoKind = 'vimeo' | 'youtube' | 'native'

const SAFETY_MS = 8000

function withParam(url: string, param: string): string {
  return url + (url.includes('?') ? '&' : '?') + param
}

export function VideoContent({
  kind,
  embedUrl,
  mediaUrl,
  title,
  bumperEligible = false,
}: {
  kind: VideoKind
  embedUrl?: string
  mediaUrl: string
  title: string
  bumperEligible?: boolean
}) {
  const partnerBumper = usePartnerBumper()
  const bumper = bumperEligible ? partnerBumper : null

  const [phase, setPhase] = useState<'gate' | 'bumper' | 'playing'>(
    bumper ? 'gate' : 'playing'
  )
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<number | null>(null)

  function finishBumper() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const a = audioRef.current
    if (a) {
      a.onended = null
      a.onerror = null
    }
    setPhase('playing')
  }

  function startBumper() {
    if (!bumper) {
      setPhase('playing')
      return
    }
    setPhase('bumper')
    let a = audioRef.current
    if (!a) {
      a = new Audio()
      audioRef.current = a
    }
    a.src = bumper.url
    a.onended = finishBumper
    a.onerror = finishBumper
    timerRef.current = window.setTimeout(finishBumper, SAFETY_MS)
    a.play().catch(finishBumper) // autoplay blocked / decode error → just play the video
  }

  // Stop a dangling bumper if the lesson unmounts mid-pre-roll (the Audio is
  // detached from the DOM, so it would otherwise keep playing after navigation).
  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
      const a = audioRef.current
      if (a) {
        a.pause()
        a.onended = null
        a.onerror = null
        a.src = ''
      }
    }
  }, [])

  // Only autoplay the content when we revealed it after a bumper (i.e. off the
  // back of the user's gesture on the gate). No bumper → no autoplay.
  const autoplay = phase === 'playing' && bumper != null

  if (phase === 'playing') {
    return <Player kind={kind} embedUrl={embedUrl} mediaUrl={mediaUrl} title={title} autoplay={autoplay} />
  }

  return (
    <div className="lesson-video-wrap">
      <div className="video-wrapper">
        <div className="video-bumper">
          {bumper!.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="video-bumper__logo" src={bumper!.logoUrl} alt="" />
          ) : null}
          <p className="video-bumper__eyebrow">Brought to you by</p>
          <p className="video-bumper__name">{bumper!.partnerName}</p>

          {phase === 'gate' ? (
            <button
              type="button"
              className="video-bumper__play"
              onClick={startBumper}
              aria-label="Play"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true">
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
              Play
            </button>
          ) : (
            <span className="video-bumper__starting" aria-live="polite">
              Starting&hellip;
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Player({
  kind,
  embedUrl,
  mediaUrl,
  title,
  autoplay,
}: {
  kind: VideoKind
  embedUrl?: string
  mediaUrl: string
  title: string
  autoplay: boolean
}) {
  if (kind === 'native') {
    return (
      <div className="lesson-video-wrap">
        <div className="video-wrapper">
          <video controls autoPlay={autoplay} src={mediaUrl} preload="metadata" style={{ width: '100%' }}>
            Your browser doesn&apos;t support the video element.
          </video>
        </div>
      </div>
    )
  }

  // Vimeo / YouTube iframe. autoplay=1 only after the bumper; muted is left off
  // on purpose — it follows the user's gesture on the gate, so sound is allowed
  // on desktop (mobile may need one more tap, which the embed surfaces itself).
  const allow =
    kind === 'youtube'
      ? 'autoplay; encrypted-media; picture-in-picture'
      : 'autoplay; fullscreen; picture-in-picture'
  const src = autoplay && embedUrl ? withParam(embedUrl, 'autoplay=1') : embedUrl

  return (
    <div className="lesson-video-wrap">
      <div className="video-wrapper">
        <iframe src={src} title={title} frameBorder={0} allow={allow} allowFullScreen />
      </div>
    </div>
  )
}
