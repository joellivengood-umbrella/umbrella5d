'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { isWatched, type VideoWatch, type VideoWatchMap } from '@/lib/video-progress'

/**
 * Shares video watch progress on a lesson page: the player reads where to
 * resume and reports how far the member has watched; Mark Complete and the
 * 5D Machine step checkboxes read whether each video has reached 90%.
 */
type Ctx = {
  get: (sourceId: string) => VideoWatch | undefined
  report: (sourceId: string, watch: VideoWatch) => void
}

const WatchProgressContext = createContext<Ctx | null>(null)

export function WatchProgressProvider({
  initial,
  children,
}: {
  initial: VideoWatchMap
  children: ReactNode
}) {
  const [map, setMap] = useState<VideoWatchMap>(initial)

  const report = useCallback((sourceId: string, watch: VideoWatch) => {
    setMap((m) => {
      const prev = m[sourceId]
      const next: VideoWatch = {
        position: watch.position,
        // Never moves backward (a rewind doesn't un-watch anything).
        furthest: Math.max(prev?.furthest ?? 0, watch.furthest),
        duration: watch.duration || prev?.duration || 0,
      }
      // Skip the re-render when nothing a gate cares about changed.
      if (
        prev &&
        isWatched(prev) === isWatched(next) &&
        prev.duration === next.duration &&
        Math.abs(prev.furthest - next.furthest) < 1
      ) {
        return m
      }
      return { ...m, [sourceId]: next }
    })
  }, [])

  const value = useMemo<Ctx>(() => ({ get: (id) => map[id], report }), [map, report])
  return <WatchProgressContext.Provider value={value}>{children}</WatchProgressContext.Provider>
}

/** Null outside a provider (e.g. a video somewhere without a gate). */
export function useWatchProgress(): Ctx | null {
  return useContext(WatchProgressContext)
}
