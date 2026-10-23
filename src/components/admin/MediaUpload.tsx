'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadLessonMedia, type MediaKind } from '@/lib/lesson-media'

/**
 * Upload a lesson's media straight from the admin panel. The file goes into
 * the lesson-media bucket under `folder` (sorted per course/lesson — see
 * lib/lesson-media.ts), in resumable chunks with a progress bar, and its
 * public URL is handed to `onChange`. A pasted link still works as a
 * fallback. Used by the lesson form, the 5D Machine block editor, and
 * partner bumpers.
 *
 * Replaced files are cleaned up by the caller when it SAVES (so cancelling
 * an edit never deletes the file still in use).
 */
const ACCEPT: Record<MediaKind, string> = {
  audio: 'audio/*',
  video: 'video/mp4,video/webm,video/quicktime',
  image: 'image/*',
}

export function MediaUpload({
  kind,
  url,
  folder,
  onChange,
  onUploadingChange,
}: {
  kind: MediaKind
  url: string
  /** Where uploads land inside lesson-media, e.g. "mba/5hr/lesson-003". */
  folder: string
  onChange: (url: string) => void
  /** Lets a form hold its Save button while a file is still uploading. */
  onUploadingChange?: (uploading: boolean) => void
}) {
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef<(() => void) | null>(null)
  const uploading = progress !== null

  // Abandon an in-flight upload if the editor goes away.
  useEffect(() => () => cancelRef.current?.(), [])

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setProgress(0)
    onUploadingChange?.(true)
    const job = uploadLessonMedia({
      supabase: createClient(),
      file,
      folder,
      kind,
      onProgress: setProgress,
    })
    cancelRef.current = job.cancel
    try {
      const { url: publicUrl } = await job.promise
      onChange(publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      cancelRef.current = null
      setProgress(null)
      onUploadingChange?.(false)
    }
  }

  function cancel() {
    cancelRef.current?.()
    cancelRef.current = null
    setProgress(null)
    onUploadingChange?.(false)
  }

  return (
    <div className="lbe-media">
      {url && !uploading ? <MediaPreview kind={kind} url={url} /> : null}

      {uploading ? (
        <div className="lbe-media__progress" role="status" aria-live="polite">
          <div className="lbe-media__bar" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
          <span className="lbe-media__pct">Uploading… {progress}%</span>
          <button type="button" className="lbe-media__clear" onClick={cancel}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="lbe-media__controls">
          <label className="btn btn--secondary btn--sm lbe-media__pick">
            {url ? 'Replace file' : 'Upload file'}
            <input type="file" accept={ACCEPT[kind]} onChange={handleFile} hidden />
          </label>
          <input
            type="url"
            className="lbe-media__url"
            value={url}
            onChange={(e) => onChange(e.target.value)}
            placeholder="…or paste a link to an uploaded file"
          />
          {url ? (
            <button
              type="button"
              className="lbe-media__clear"
              onClick={() => onChange('')}
              aria-label="Remove media"
            >
              Clear
            </button>
          ) : null}
        </div>
      )}

      {error ? <p className="lbe-media__error">{error}</p> : null}
    </div>
  )
}

function MediaPreview({ kind, url }: { kind: MediaKind; url: string }) {
  if (kind === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary Storage URL
      <img className="lbe-media__preview-img" src={url} alt="" />
    )
  }
  if (kind === 'audio') {
    return <audio className="lbe-media__preview" controls src={url} preload="metadata" />
  }
  return <video className="lbe-media__preview" controls src={url} preload="metadata" />
}
