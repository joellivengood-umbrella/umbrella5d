'use client'

import { useEffect, useRef, useState } from 'react'
import { usePartnerBumper } from '@/components/app/PartnerBumperContext'
import { VideoPlayer } from './video/VideoPlayer'

/**
 * Lesson video with an optional partner pre-roll. The video itself is our
 * own VideoPlayer (uploaded files only — no Vimeo/YouTube embeds).
 *
 * The bumper is an AUDIO clip, so for video we play it over a branded card
 * that overlays the 16:9 area. Flow:
 *   gate    → branded card with a Play button (the required user gesture)
 *   bumper  → card stays, the audio clip plays
 *   playing → card gone, the player is mounted and starts playing
 *
 * A failed/hung bumper falls through to the player (catch + safety timeout).
 * Members with no eligible bumper get the player straight away (no autoplay).
 */
const SAFETY_MS = 8000

export function VideoContent({
  mediaUrl,
  title,
  sourceId = null,
  bumperEligible = false,
}: {
  mediaUrl: string
  title: string
  /** content_items / lesson_blocks id: saves progress and drives the 90% gate. */
  sourceId?: string | null
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
    return (
      <div className="lesson-video-wrap">
        <VideoPlayer src={mediaUrl} title={title} sourceId={sourceId} autoplay={autoplay} />
      </div>
    )
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
