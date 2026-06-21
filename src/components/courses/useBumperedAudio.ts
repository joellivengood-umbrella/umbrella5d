import { useCallback, useRef, useState } from 'react'

/**
 * Plays a short partner "Brought to you by …" bumper as a pre-roll on the
 * caller's OWN <audio> element, then swaps to the real content. One element
 * (not two) keeps it unlocked across the handoff on iOS — the same src-swap
 * the POTD player already relies on.
 *
 * The hook owns a `phase`; the caller wires its element events through it so
 * the scrubber/duration and the 'ended' that means "content finished" stay
 * tied to the content, never the 4s bumper:
 *
 *   startFresh(contentSrc) — begin playback from zero. Bumper first if one is
 *     set, otherwise content immediately.
 *   onEnded()  — call from the element's `ended`. Returns true only when the
 *     CONTENT ended (bumper-ended is handled internally by swapping to
 *     content). Caller runs its content-ended logic only on true.
 *   isBumperPhase() — true while the bumper is playing; caller hides the
 *     content scrubber, ignores timeupdate/metadata, and blocks seek/skip.
 *   reset() — drop bumper state (e.g. when the player is closed).
 *
 * A failed or hung bumper never blocks the content: play() rejection, an
 * `error`, or a safety timeout all fall through to the content.
 */
const SAFETY_MS = 8000

type Phase = 'idle' | 'bumper' | 'content'

export function useBumperedAudio(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  bumperUrl: string | null
) {
  const phaseRef = useRef<Phase>('idle')
  const pendingContentRef = useRef<string | null>(null)
  const safetyRef = useRef<number | null>(null)
  const [bumperPlaying, setBumperPlaying] = useState(false)

  const clearSafety = useCallback(() => {
    if (safetyRef.current != null) {
      window.clearTimeout(safetyRef.current)
      safetyRef.current = null
    }
  }, [])

  const swapToContent = useCallback(() => {
    clearSafety()
    phaseRef.current = 'content'
    setBumperPlaying(false)
    const a = audioRef.current
    const contentSrc = pendingContentRef.current
    pendingContentRef.current = null
    if (!a || !contentSrc) return
    if (a.src !== contentSrc) {
      a.src = contentSrc
      a.load()
    }
    try {
      a.currentTime = 0
    } catch {
      /* not seekable yet — fine */
    }
    a.play().catch(() => {})
  }, [audioRef, clearSafety])

  const startFresh = useCallback(
    (contentSrc: string) => {
      const a = audioRef.current
      if (!a) return

      // No bumper (none set, or not eligible) → content straight away.
      if (!bumperUrl) {
        phaseRef.current = 'content'
        setBumperPlaying(false)
        if (a.src !== contentSrc) {
          a.src = contentSrc
          a.load()
        }
        try {
          a.currentTime = 0
        } catch {
          /* noop */
        }
        a.play().catch(() => {})
        return
      }

      // Bumper first, content held until it finishes.
      pendingContentRef.current = contentSrc
      phaseRef.current = 'bumper'
      setBumperPlaying(true)
      a.src = bumperUrl
      a.load()
      a.play().catch(() => swapToContent()) // can't play the bumper → skip it
      clearSafety()
      safetyRef.current = window.setTimeout(() => {
        if (phaseRef.current === 'bumper') swapToContent()
      }, SAFETY_MS)
    },
    [audioRef, bumperUrl, swapToContent, clearSafety]
  )

  /** From the element's onEnded. True only when the CONTENT ended. */
  const onEnded = useCallback((): boolean => {
    if (phaseRef.current === 'bumper') {
      swapToContent()
      return false
    }
    phaseRef.current = 'idle'
    return true
  }, [swapToContent])

  const isBumperPhase = useCallback(() => phaseRef.current === 'bumper', [])

  const reset = useCallback(() => {
    clearSafety()
    phaseRef.current = 'idle'
    pendingContentRef.current = null
    setBumperPlaying(false)
  }, [clearSafety])

  return { bumperPlaying, startFresh, onEnded, isBumperPhase, reset }
}
