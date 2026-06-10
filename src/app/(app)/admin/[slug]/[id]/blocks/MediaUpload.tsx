'use client'

import { useState, type ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Upload a file to the public 'lesson-media' Storage bucket and return
 * its public URL — the same flow as the Settings avatar upload. Also
 * accepts a pasted URL as a fallback. Used by audio/video/image blocks
 * in the lesson editor.
 */
const ACCEPT: Record<MediaKind, string> = {
  audio: 'audio/*',
  video: 'video/*',
  image: 'image/*',
}

// Soft client-side ceiling; the bucket may impose its own smaller limit.
const MAX_BYTES = 200 * 1024 * 1024

type MediaKind = 'audio' | 'video' | 'image'

export function MediaUpload({
  kind,
  url,
  onChange,
}: {
  kind: MediaKind
  url: string
  onChange: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_BYTES) {
      setError('File is too large.')
      e.target.value = ''
      return
    }

    setUploading(true)
    setError(null)

    const supabase = createClient()

    // Readable, collision-proof name: a sanitized version of the
    // original filename + a short random tag, inside the per-type folder
    // (e.g. image/essential-prerequisites-a1b2c3d4.png). Keeps the
    // bucket easy to browse and hand-organize later.
    const dot = file.name.lastIndexOf('.')
    const ext = (dot > 0 ? file.name.slice(dot + 1) : 'bin').toLowerCase()
    const base =
      (dot > 0 ? file.name.slice(0, dot) : file.name)
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
        .replace(/-+$/, '') || 'file'
    const tag = crypto.randomUUID().slice(0, 8)
    const path = `${kind}/${base}-${tag}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('lesson-media')
      .upload(path, file, { upsert: false, contentType: file.type })

    if (upErr) {
      setUploading(false)
      setError(upErr.message)
      e.target.value = ''
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('lesson-media').getPublicUrl(path)

    onChange(publicUrl)
    setUploading(false)
    e.target.value = ''
  }

  return (
    <div className="lbe-media">
      {url ? <MediaPreview kind={kind} url={url} /> : null}

      <div className="lbe-media__controls">
        <label className="btn btn--secondary btn--sm lbe-media__pick">
          {uploading ? 'Uploading…' : url ? 'Replace file' : 'Upload file'}
          <input
            type="file"
            accept={ACCEPT[kind]}
            onChange={handleFile}
            disabled={uploading}
            hidden
          />
        </label>
        <input
          type="url"
          className="lbe-media__url"
          value={url}
          onChange={(e) => onChange(e.target.value)}
          placeholder="…or paste a media URL"
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
