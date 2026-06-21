'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePartnerBumper } from '@/components/app/PartnerBumperContext'
import { useBumperedAudio } from '@/components/courses/useBumperedAudio'

/**
 * Global, navigation-persistent audio player for POTD (Daily Pod).
 *
 * The whole point of this component is that the single <audio> element
 * lives HERE, in a provider mounted in the app layout — which does not
 * unmount as the user navigates between pages within the (app) route
 * group. That's what lets a pod keep playing while the user browses to
 * the feed, settings, etc.
 *
 * Only POTD uses this. The other course types are video and keep their
 * own inline players (no cross-navigation playback).
 *
 * Behavior of note:
 *   - play(track) loads + plays a new episode, or resumes if it's
 *     already the current one.
 *   - When an episode finishes (audio 'ended'), it's auto-marked
 *     complete in content_progress and the server tree is refreshed so
 *     the "heard" count + done states update.
 */

export type PotdTrack = {
  itemId: string // content_item UUID — used for auto-complete
  episodeNum: number
  title: string
  mediaUrl: string
}

type PlayerContextValue = {
  current: PotdTrack | null
  isPlaying: boolean
  /** Start (or resume) a track. */
  play: (track: PotdTrack) => void
  /** Toggle play/pause on the current track. */
  toggle: () => void
  /** Stop and dismiss the player. */
  close: () => void
}

const PotdPlayerContext = createContext<PlayerContextValue | null>(null)

export function usePotdPlayer(): PlayerContextValue {
  const ctx = useContext(PotdPlayerContext)
  if (!ctx) {
    throw new Error('usePotdPlayer must be used within <PotdPlayerProvider>')
  }
  return ctx
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Podcast-style playback speeds the rate button cycles through.
const PLAYBACK_RATES = [1, 1.25, 1.5, 1.75, 2] as const

function formatRate(rate: number): string {
  // 1 → "1×", 1.5 → "1.5×" (no trailing zeros).
  return `${rate}×`
}

export function PotdPlayerProvider({
  userId,
  children,
}: {
  userId: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const audioRef = useRef<HTMLAudioElement>(null)

  const [current, setCurrent] = useState<PotdTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [rate, setRate] = useState<number>(1)

  // Remembers the last non-zero volume so the mute toggle can restore it.
  const lastVolumeRef = useRef(1)

  // Mirrors `rate` so the track-load effect can re-apply the chosen speed
  // without taking `rate` as a dependency (which would restart playback
  // every time the speed changes).
  const rateRef = useRef(1)

  // Tracks which itemIds we've already auto-completed this session, so a
  // replay doesn't spam the DB / router.refresh on every 'ended'.
  const autoCompletedRef = useRef<Set<string>>(new Set())

  // Partner "Brought to you by …" pre-roll. POTD is always eligible — the
  // Machine exclusion only applies to inline lesson audio. Null when the
  // member's partner has no bumper (or they have no partner).
  const partnerBumper = usePartnerBumper()
  const partnerName = partnerBumper?.partnerName ?? ''
  const { bumperPlaying, startFresh, onEnded: onBumperEnded, isBumperPhase, reset } =
    useBumperedAudio(audioRef, partnerBumper?.url ?? null)

  const play = useCallback(
    (track: PotdTrack) => {
      // Same track already loaded → just resume, don't reload (no bumper).
      if (current?.itemId === track.itemId) {
        audioRef.current?.play().catch(() => {})
        return
      }
      // New track: reset the scrubber (so it reads 0:00 during the bumper, not
      // the previous track's position) and start fresh — the partner bumper, if
      // any, plays first, then the episode. The <audio> element is always
      // mounted here, so we can drive it straight from this handler.
      setCurrentTime(0)
      setDuration(0)
      setCurrent(track)
      startFresh(track.mediaUrl)
    },
    [current, startFresh]
  )

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }, [])

  const close = useCallback(() => {
    audioRef.current?.pause()
    reset()
    setCurrent(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [reset])

  // Reserve space at the bottom of the scroll area so the fixed bar
  // doesn't cover page content / the footer.
  useEffect(() => {
    document.body.classList.toggle('potd-player-active', current != null)
    return () => document.body.classList.remove('potd-player-active')
  }, [current])

  // Keep the element's volume in sync with state. The volume property is
  // an attribute of the <audio> element (not the media), so it persists
  // across track changes — setting it on change is enough.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  // Keep the element's playback speed in sync with state.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate
  }, [rate])

  function rewind15() {
    if (isBumperPhase()) return // no scrubbing during the sponsor pre-roll
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, audio.currentTime - 15)
    setCurrentTime(audio.currentTime)
  }

  function forward15() {
    if (isBumperPhase()) return
    const audio = audioRef.current
    if (!audio) return
    const max = Number.isFinite(audio.duration) ? audio.duration : Infinity
    audio.currentTime = Math.min(max, audio.currentTime + 15)
    setCurrentTime(audio.currentTime)
  }

  function cycleRate() {
    const idx = PLAYBACK_RATES.indexOf(rateRef.current as (typeof PLAYBACK_RATES)[number])
    const next = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length]
    rateRef.current = next
    setRate(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  function changeVolume(v: number) {
    setVolume(v)
    if (v > 0) lastVolumeRef.current = v
  }

  function toggleMute() {
    if (volume > 0) {
      lastVolumeRef.current = volume
      setVolume(0)
    } else {
      setVolume(lastVolumeRef.current || 1)
    }
  }

  async function handleEnded() {
    // A finished bumper swaps to the episode and returns false — only run the
    // auto-complete when the EPISODE itself ended.
    if (!onBumperEnded()) return
    setIsPlaying(false)
    if (!current) return
    if (autoCompletedRef.current.has(current.itemId)) return
    autoCompletedRef.current.add(current.itemId)

    const supabase = createClient()
    const { error } = await supabase
      .from('content_progress')
      .upsert(
        { user_id: userId, content_item_id: current.itemId },
        { onConflict: 'user_id,content_item_id' }
      )
    if (error) {
      console.error('POTD auto-complete error', error)
      // Allow a retry on a later 'ended' if the write failed.
      autoCompletedRef.current.delete(current.itemId)
      return
    }
    // Refresh server components so "heard" counts + done states update.
    router.refresh()
  }

  // Drag-to-scrub via pointer events (mouse + touch). Pointer capture keeps
  // move events flowing even when the finger/cursor leaves the thin bar.
  // Disabled during the bumper pre-roll, same as the skip buttons.
  const scrubbingRef = useRef(false)

  function seekToClientX(clientX: number, trackEl: HTMLDivElement) {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(duration) || duration <= 0) return
    const rect = trackEl.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    audio.currentTime = fraction * duration
    setCurrentTime(audio.currentTime)
  }

  function onTrackPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (isBumperPhase()) return
    scrubbingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    seekToClientX(e.clientX, e.currentTarget)
  }

  function onTrackPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!scrubbingRef.current) return
    seekToClientX(e.clientX, e.currentTarget)
  }

  function endScrub(e: React.PointerEvent<HTMLDivElement>) {
    if (!scrubbingRef.current) return
    scrubbingRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* pointer already released */
    }
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <PotdPlayerContext.Provider value={{ current, isPlaying, play, toggle, close }}>
      {children}

      {/* The persistent audio element. Hidden — driven programmatically.
          Lives here so navigation never unmounts it. */}
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        onTimeUpdate={(e) => {
          if (!isBumperPhase()) setCurrentTime(e.currentTarget.currentTime)
        }}
        onLoadedMetadata={(e) => {
          // Ignore the bumper's metadata (its 4s duration isn't the episode's).
          if (isBumperPhase()) return
          setDuration(e.currentTarget.duration)
          // load() resets playbackRate in some browsers; re-assert the choice.
          e.currentTarget.playbackRate = rateRef.current
        }}
      />

      {current && (
        <div className="potd-miniplayer" role="region" aria-label="Daily Pod player">
          <div className="potd-miniplayer__info">
            <div className="potd-miniplayer__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <div className="potd-miniplayer__meta">
              <span className="potd-miniplayer__eyebrow">
                {bumperPlaying ? 'Sponsor' : 'Daily Pod'}
              </span>
              <span className="potd-miniplayer__title">
                {bumperPlaying
                  ? `Brought to you by ${partnerName}`
                  : `Episode ${current.episodeNum} — ${current.title}`}
              </span>
            </div>
          </div>

          <div className="potd-miniplayer__controls">
            <button
              type="button"
              className="potd-miniplayer__skipbtn"
              onClick={rewind15}
              aria-label="Rewind 15 seconds"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" aria-hidden="true">
                <polyline points="11 17 6 12 11 7" />
                <path d="M6 12h9a5 5 0 0 1 0 10h-1" />
              </svg>
              <span className="potd-miniplayer__skiplabel">15</span>
            </button>

            <button
              type="button"
              className="potd-miniplayer__playbtn"
              onClick={toggle}
              aria-label={isPlaying || bumperPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying || bumperPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26" aria-hidden="true">
                  <polygon points="6 4 20 12 6 20 6 4" />
                </svg>
              )}
            </button>

            <button
              type="button"
              className="potd-miniplayer__skipbtn"
              onClick={forward15}
              aria-label="Forward 15 seconds"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" aria-hidden="true">
                <polyline points="13 17 18 12 13 7" />
                <path d="M18 12H9a5 5 0 0 0 0 10h1" />
              </svg>
              <span className="potd-miniplayer__skiplabel">15</span>
            </button>

            <div className="potd-miniplayer__scrubber">
              <span className="potd-miniplayer__time">{formatTime(currentTime)}</span>
              <div
                className="potd-miniplayer__track"
                onPointerDown={onTrackPointerDown}
                onPointerMove={onTrackPointerMove}
                onPointerUp={endScrub}
                onPointerCancel={endScrub}
                role="presentation"
              >
                <div
                  className="potd-miniplayer__fill"
                  style={{ width: `${pct}%` }}
                >
                  <span className="potd-miniplayer__thumb" aria-hidden="true" />
                </div>
              </div>
              <span className="potd-miniplayer__time">{formatTime(duration)}</span>
            </div>
          </div>

          <button
            type="button"
            className="potd-miniplayer__ratebtn"
            onClick={cycleRate}
            aria-label={`Playback speed ${formatRate(rate)}. Tap to change.`}
          >
            {formatRate(rate)}
          </button>

          <div className="potd-miniplayer__volume">
            <button
              type="button"
              className="potd-miniplayer__volbtn"
              onClick={toggleMute}
              aria-label={volume === 0 ? 'Unmute' : 'Mute'}
            >
              {volume === 0 ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22" aria-hidden="true">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : volume < 0.5 ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22" aria-hidden="true">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22" aria-hidden="true">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </button>
            <input
              type="range"
              className="potd-miniplayer__volslider"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => changeVolume(parseFloat(e.target.value))}
              aria-label="Volume"
            />
          </div>

          <button
            type="button"
            className="potd-miniplayer__close"
            onClick={close}
            aria-label="Close player"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </PotdPlayerContext.Provider>
  )
}
