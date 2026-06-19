'use client'

import { useRef, useState } from 'react'

/**
 * A designed, inline audio player for lesson audio (5D Machine blocks and any
 * audio-kind lesson). Styled after the POTD floating player — big gradient
 * play button, scrubber, speed, refined volume — but inline, with no skip or
 * close, and themed entirely from the lesson's --ct-* vars (inherited from
 * the course <main>), so each lesson's player takes that lesson's colour.
 *
 * A plain inline <audio> per player; navigating away stops it (that's fine —
 * lesson audio isn't the persistent Daily Pod).
 */

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function LessonAudioPlayer({
  src,
  title,
}: {
  src: string
  title?: string | null
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const lastVolumeRef = useRef(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(duration) || duration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    audio.currentTime = fraction * duration
    setCurrentTime(audio.currentTime)
  }

  function changeVolume(v: number) {
    setVolume(v)
    if (v > 0) lastVolumeRef.current = v
    if (audioRef.current) audioRef.current.volume = v
  }

  function toggleMute() {
    if (volume > 0) {
      lastVolumeRef.current = volume
      changeVolume(0)
    } else {
      changeVolume(lastVolumeRef.current || 1)
    }
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      className="lap"
      role="region"
      aria-label={title ? `Audio: ${title}` : 'Audio player'}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />

      <button
        type="button"
        className="lap__play"
        onClick={toggle}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26" aria-hidden="true">
            <polygon points="7 4 20 12 7 20 7 4" />
          </svg>
        )}
      </button>

      <div className="lap__scrubber">
        <span className="lap__time">{formatTime(currentTime)}</span>
        <div className="lap__track" onClick={handleSeek} role="presentation">
          <div className="lap__fill" style={{ width: `${pct}%` }}>
            <span className="lap__thumb" aria-hidden="true" />
          </div>
        </div>
        <span className="lap__time lap__time--dur">{formatTime(duration)}</span>
      </div>

      <div className="lap__volume">
        <button
          type="button"
          className="lap__volbtn"
          onClick={toggleMute}
          aria-label={volume === 0 ? 'Unmute' : 'Mute'}
        >
          {volume === 0 ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : volume < 0.5 ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
        </button>
        <input
          type="range"
          className="lap__volslider"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => changeVolume(parseFloat(e.target.value))}
          aria-label="Volume"
        />
      </div>
    </div>
  )
}
