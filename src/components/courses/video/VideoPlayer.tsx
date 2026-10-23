'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveVideoProgress } from '@/lib/video-progress'
import { useWatchProgress } from './WatchProgress'

/**
 * Umbrella's own lesson video player (uploaded MP4s only — no embeds).
 *
 * Deliberately focused: play/pause, rewind 15s, volume, speed up to 1.5×,
 * full screen. There is NO skip-forward and the progress bar can't be
 * dragged — members watch through, and can only go back. A guard also snaps
 * back any forward jump (e.g. from a phone's own full-screen controls) and
 * caps speed at 1.5×. No floating / picture-in-picture: the lesson keeps
 * their attention.
 *
 * With a `sourceId`, progress is saved (resume point + furthest point
 * actually played) and reported to the page's WatchProgressProvider, which
 * unlocks completion at 90% watched.
 */

const RATES = [1, 1.25, 1.5] as const
const MAX_RATE = 1.5
const REWIND_SECONDS = 15
const SAVE_EVERY_MS = 10_000
const HIDE_CONTROLS_MS = 2500
// Normal playback advances a fraction of a second per timeupdate; anything
// bigger than this is a jump, not watching.
const MAX_NATURAL_STEP = 2.5

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ss = s.toString().padStart(2, '0')
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

type FsVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void }

export function VideoPlayer({
  src,
  title,
  sourceId = null,
  autoplay = false,
}: {
  src: string
  title?: string | null
  /** content_items id or lesson_blocks id; enables saving + the 90% gate. */
  sourceId?: string | null
  autoplay?: boolean
}) {
  const watch = useWatchProgress()
  const videoRef = useRef<FsVideo>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const lastTime = useRef(0) // last legitimately reached position
  const furthest = useRef(0)
  const lastSave = useRef(0)
  const hideTimer = useRef<number | null>(null)
  const resumed = useRef(false)

  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState<number>(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [controlsShown, setControlsShown] = useState(true)
  const [started, setStarted] = useState(false)

  const save = useCallback(() => {
    const v = videoRef.current
    if (!sourceId || !v || !(v.duration > 0)) return
    lastSave.current = Date.now()
    void saveVideoProgress(createClient(), sourceId, v.currentTime, v.duration)
  }, [sourceId])

  const report = useCallback(() => {
    const v = videoRef.current
    if (!sourceId || !watch || !v || !(v.duration > 0)) return
    watch.report(sourceId, { position: v.currentTime, furthest: furthest.current, duration: v.duration })
  }, [sourceId, watch])

  // Save when the tab is hidden or the player goes away.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') save()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      save()
    }
  }, [save])

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === wrapRef.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => {
    return () => {
      if (hideTimer.current != null) window.clearTimeout(hideTimer.current)
    }
  }, [])

  // Start right away when revealed after a partner bumper (the user already
  // pressed Play on the bumper card).
  useEffect(() => {
    if (autoplay) videoRef.current?.play().catch(() => {})
  }, [autoplay])

  const showControls = useCallback(() => {
    setControlsShown(true)
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsShown(false)
    }, HIDE_CONTROLS_MS)
  }, [])

  // Duration known: show it, apply the speed, and resume where they left off.
  function onMetadata(v: HTMLVideoElement) {
    setDuration(v.duration)
    v.playbackRate = rate
    if (resumed.current) return
    resumed.current = true
    const saved = sourceId ? watch?.get(sourceId) : undefined
    if (saved) {
      furthest.current = saved.furthest
      // Resume where they left off (unless they'd basically finished).
      if (saved.position > 1 && saved.position < v.duration - 3) {
        lastTime.current = saved.position
        v.currentTime = saved.position
        setCurrent(saved.position)
      }
    }
  }

  // The server-rendered <video> can finish loading its metadata before React
  // attaches onLoadedMetadata — catch that case on mount.
  useEffect(() => {
    const v = videoRef.current
    if (v && v.readyState >= 1) onMetadata(v)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, [])

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused || v.ended) v.play().catch(() => {})
    else v.pause()
  }

  function rewind() {
    const v = videoRef.current
    if (!v) return
    const t = Math.max(0, v.currentTime - REWIND_SECONDS)
    lastTime.current = t
    v.currentTime = t
    setCurrent(t)
    showControls()
  }

  function cycleRate() {
    const v = videoRef.current
    const i = RATES.indexOf(rate as (typeof RATES)[number])
    const next = RATES[(i + 1) % RATES.length]
    setRate(next)
    if (v) v.playbackRate = next
  }

  function changeVolume(next: number) {
    const v = videoRef.current
    setVolume(next)
    setMuted(next === 0)
    if (v) {
      v.volume = next
      v.muted = next === 0
    }
  }

  function toggleMute() {
    const v = videoRef.current
    if (!v) return
    const nextMuted = !(muted || volume === 0)
    if (!nextMuted && volume === 0) changeVolume(1)
    else {
      v.muted = nextMuted
      setMuted(nextMuted)
    }
  }

  function toggleFullscreen() {
    const wrap = wrapRef.current
    const v = videoRef.current
    if (!wrap || !v) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else if (wrap.requestFullscreen) {
      void wrap.requestFullscreen().catch(() => v.webkitEnterFullscreen?.())
    } else {
      // iPhone Safari: only the video element itself can go full screen.
      v.webkitEnterFullscreen?.()
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const key = e.key.toLowerCase()
    if (key === ' ' || key === 'k') togglePlay()
    else if (key === 'arrowleft' || key === 'j') rewind()
    else if (key === 'f') toggleFullscreen()
    else if (key === 'm') toggleMute()
    else return
    e.preventDefault()
    showControls()
  }

  const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0
  const isMuted = muted || volume === 0
  const hidden = playing && !controlsShown

  return (
    <div
      ref={wrapRef}
      className={'vp' + (hidden ? ' vp--idle' : '') + (fullscreen ? ' vp--fs' : '')}
      tabIndex={0}
      role="region"
      aria-label={title ? `Video: ${title}` : 'Video player'}
      onKeyDown={onKeyDown}
      onPointerMove={showControls}
      onFocus={showControls}
    >
      <video
        ref={videoRef}
        className="vp__video"
        src={src}
        preload="metadata"
        playsInline
        disablePictureInPicture
        controlsList="nodownload noplaybackrate noremoteplayback"
        onContextMenu={(e) => e.preventDefault()}
        onClick={togglePlay}
        onPlay={() => {
          setPlaying(true)
          setStarted(true)
          showControls()
        }}
        onPause={() => {
          setPlaying(false)
          setControlsShown(true)
          save()
        }}
        onEnded={(e) => {
          furthest.current = e.currentTarget.duration
          lastTime.current = e.currentTarget.duration
          setPlaying(false)
          setControlsShown(true)
          report()
          save()
        }}
        onLoadedMetadata={(e) => onMetadata(e.currentTarget)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget
          const t = v.currentTime
          if (t > lastTime.current && t - lastTime.current <= MAX_NATURAL_STEP) {
            furthest.current = Math.max(furthest.current, t)
          }
          if (t <= lastTime.current + MAX_NATURAL_STEP) lastTime.current = t
          setCurrent(t)
          report()
          if (!v.paused && Date.now() - lastSave.current > SAVE_EVERY_MS) save()
        }}
        onSeeking={(e) => {
          // No skipping ahead — from anywhere (e.g. a phone's native
          // full-screen controls). Going back is fine.
          const v = e.currentTarget
          if (v.currentTime > lastTime.current + 1) v.currentTime = lastTime.current
        }}
        onRateChange={(e) => {
          const v = e.currentTarget
          if (v.playbackRate > MAX_RATE) v.playbackRate = MAX_RATE
          else setRate(v.playbackRate)
        }}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume)
          setMuted(e.currentTarget.muted)
        }}
      >
        Your browser doesn&apos;t support video playback.
      </video>

      {!playing && (
        <button
          type="button"
          className="vp__bigplay"
          onClick={togglePlay}
          aria-label={started ? 'Resume' : 'Play'}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="34" height="34" aria-hidden="true">
            <polygon points="7 4 20 12 7 20 7 4" />
          </svg>
        </button>
      )}

      <div className="vp__controls" aria-hidden={hidden || undefined}>
        <div
          className="vp__track"
          role="progressbar"
          aria-label="Video progress"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          aria-valuetext={`${formatTime(current)} of ${formatTime(duration)}`}
        >
          <div className="vp__fill" style={{ width: `${pct}%` }} />
          <span className="vp__head" style={{ left: `${pct}%` }} aria-hidden="true" />
        </div>

        <div className="vp__bar">
          <button type="button" className="vp__btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true">
                <polygon points="7 4 20 12 7 20 7 4" />
              </svg>
            )}
          </button>

          <button type="button" className="vp__btn vp__rewind" onClick={rewind} aria-label="Rewind 15 seconds">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <polyline points="3 3 3 9 9 9" />
            </svg>
            <span className="vp__rewind-num" aria-hidden="true">15</span>
          </button>

          <span className="vp__time">
            {formatTime(current)} <span className="vp__time-sep">/</span> {formatTime(duration)}
          </span>

          <span className="vp__spacer" />

          <div className="vp__volume">
            <button type="button" className="vp__btn" onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" width="21" height="21" aria-hidden="true">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" width="21" height="21" aria-hidden="true">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </button>
            <input
              type="range"
              className="vp__volslider"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => changeVolume(parseFloat(e.target.value))}
              aria-label="Volume"
            />
          </div>

          <button
            type="button"
            className="vp__btn vp__rate"
            onClick={cycleRate}
            aria-label={`Playback speed ${rate}×. Click to change.`}
          >
            {rate}×
          </button>

          <button
            type="button"
            className="vp__btn"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {fullscreen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true">
                <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
