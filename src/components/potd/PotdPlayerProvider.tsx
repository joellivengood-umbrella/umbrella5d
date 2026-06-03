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

  // Tracks which itemIds we've already auto-completed this session, so a
  // replay doesn't spam the DB / router.refresh on every 'ended'.
  const autoCompletedRef = useRef<Set<string>>(new Set())

  const play = useCallback(
    (track: PotdTrack) => {
      // Same track already loaded → just resume, don't reload.
      if (current?.itemId === track.itemId) {
        audioRef.current?.play().catch(() => {})
        return
      }
      setCurrent(track)
    },
    [current]
  )

  // When `current` switches to a new track, point the element at it and
  // play. Resuming the same track is handled in play() above and never
  // reaches here (current identity unchanged).
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !current) return
    if (audio.src !== current.mediaUrl) {
      audio.src = current.mediaUrl
      audio.load()
    }
    audio.play().catch(() => {})
  }, [current])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }, [])

  const close = useCallback(() => {
    audioRef.current?.pause()
    setCurrent(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [])

  // Reserve space at the bottom of the scroll area so the fixed bar
  // doesn't cover page content / the footer.
  useEffect(() => {
    document.body.classList.toggle('potd-player-active', current != null)
    return () => document.body.classList.remove('potd-player-active')
  }, [current])

  async function handleEnded() {
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

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(duration) || duration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    audio.currentTime = fraction * duration
    setCurrentTime(audio.currentTime)
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
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />

      {current && (
        <div className="potd-miniplayer" role="region" aria-label="Daily Pod player">
          <div className="potd-miniplayer__info">
            <div className="potd-miniplayer__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <div className="potd-miniplayer__meta">
              <span className="potd-miniplayer__eyebrow">Daily Pod</span>
              <span className="potd-miniplayer__title">
                Episode {current.episodeNum} — {current.title}
              </span>
            </div>
          </div>

          <div className="potd-miniplayer__controls">
            <button
              type="button"
              className="potd-miniplayer__playbtn"
              onClick={toggle}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
                  <polygon points="6 4 20 12 6 20 6 4" />
                </svg>
              )}
            </button>

            <div className="potd-miniplayer__scrubber">
              <span className="potd-miniplayer__time">{formatTime(currentTime)}</span>
              <div
                className="potd-miniplayer__track"
                onClick={handleSeek}
                role="presentation"
              >
                <div
                  className="potd-miniplayer__fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="potd-miniplayer__time">{formatTime(duration)}</span>
            </div>
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
