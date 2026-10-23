import * as tus from 'tus-js-client'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Uploading course media from the admin panel into the public
 * 'lesson-media' Storage bucket — no trip to the Supabase dashboard.
 *
 * Files are sorted automatically into a folder per course and lesson, then
 * by kind, e.g.
 *   machine/part-1/lesson-1-2/video/intro-a1b2c3d4.mp4
 *   mba/5hr/lesson-003/video/pricing-c3d4e5f6.mp4
 *   partners/greater-fort-wayne-chamber/audio/bumper-e5f6a7b8.mp3
 *
 * Uploads are resumable and chunked (TUS), so a long video survives a brief
 * connection drop and reports progress. When a file is replaced or removed,
 * removeMediaIfUnused() deletes the old one unless something else still
 * points at it (Umbrella keeps its own archive of originals).
 */

export const MEDIA_BUCKET = 'lesson-media'
// Supabase's resumable endpoint requires exactly 6 MB chunks.
const CHUNK_SIZE = 6 * 1024 * 1024

export type MediaKind = 'audio' | 'video' | 'image'

/** "Greater Fort Wayne Chamber!" → "greater-fort-wayne-chamber" */
export function slugifyPart(s: string, max = 60): string {
  return (
    s
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max)
      .replace(/-+$/, '') || 'file'
  )
}

const pad = (n: number, width = 3) => String(Math.max(0, Math.trunc(n))).padStart(width, '0')

/** Folder for a 5D Machine lesson: by Part.Lesson address when it has one. */
export function machineLessonFolder(opts: {
  partNumber: number | null
  lessonNumber: number | null
  sequenceNum: number | null
}): string {
  const { partNumber: p, lessonNumber: l, sequenceNum: n } = opts
  if (p != null && l != null) return `machine/part-${p}/lesson-${p}-${l}`
  return `machine/unassigned/lesson-${pad(n ?? 0)}`
}

/** Folder for a lesson in any other course (MBA also by version). */
export function courseLessonFolder(opts: {
  courseSlug: string
  sequenceNum: number | null
  mbaVersion?: string | null
}): string {
  const course = slugifyPart(opts.courseSlug, 40)
  const version = opts.mbaVersion ? `/${slugifyPart(opts.mbaVersion, 20)}` : ''
  const lesson = opts.sequenceNum != null && opts.sequenceNum > 0 ? `lesson-${pad(opts.sequenceNum)}` : 'unnumbered'
  return `${course}${version}/${lesson}`
}

/** Folder for a partner's bumpers. */
export function partnerFolder(partnerName: string): string {
  return `partners/${slugifyPart(partnerName, 50)}`
}

/** folder/kind/readable-name-tag.ext */
function objectPath(folder: string, kind: MediaKind, file: File): string {
  const dot = file.name.lastIndexOf('.')
  const ext = (dot > 0 ? file.name.slice(dot + 1) : 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const base = slugifyPart(dot > 0 ? file.name.slice(0, dot) : file.name)
  const tag = crypto.randomUUID().slice(0, 8)
  return `${folder}/${kind}/${base}-${tag}.${ext}`
}

/** The object path inside lesson-media for one of its public URLs, else null. */
export function mediaPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`
  const i = url.indexOf(marker)
  if (i < 0) return null
  try {
    return decodeURIComponent(url.slice(i + marker.length).split('?')[0])
  } catch {
    return null
  }
}

function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  if (/413|too large|maximum allowed size|exceeded/i.test(raw)) {
    return 'This file is larger than your storage plan currently allows. Raise the upload size limit in Supabase (Storage → Settings), then try again.'
  }
  if (/401|403|unauthori|row-level security|not allowed/i.test(raw)) {
    return 'Upload was refused — make sure you’re signed in with an admin account.'
  }
  if (/network|failed to fetch|offline/i.test(raw)) {
    return 'The connection dropped and the upload couldn’t resume. Please try again.'
  }
  return `Upload failed: ${raw}`
}

/**
 * Upload a file into `folder` (resumable, chunked). Resolves with its public
 * URL; `onProgress` gets 0–100.
 */
export function uploadLessonMedia(opts: {
  supabase: SupabaseClient
  file: File
  folder: string
  kind: MediaKind
  onProgress?: (pct: number) => void
}): { promise: Promise<{ url: string; path: string }>; cancel: () => void } {
  const { supabase, file, folder, kind, onProgress } = opts
  const path = objectPath(folder, kind, file)
  let upload: tus.Upload | null = null

  const promise = new Promise<{ url: string; path: string }>((resolve, reject) => {
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        reject(new Error('Please sign in again, then retry the upload.'))
        return
      }
      upload = new tus.Upload(file, {
        endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
        retryDelays: [0, 2000, 5000, 10000, 20000],
        chunkSize: CHUNK_SIZE,
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
          authorization: `Bearer ${data.session.access_token}`,
          'x-upsert': 'false',
        },
        metadata: {
          bucketName: MEDIA_BUCKET,
          objectName: path,
          contentType: file.type || 'application/octet-stream',
          cacheControl: '3600',
        },
        // Fresh token on every chunk, so a long upload outlives the session's
        // hourly token refresh.
        onBeforeRequest: async (req) => {
          const { data: s } = await supabase.auth.getSession()
          if (s.session) req.setHeader('authorization', `Bearer ${s.session.access_token}`)
        },
        onProgress: (sent, total) => {
          if (total > 0) onProgress?.(Math.min(100, Math.round((sent / total) * 100)))
        },
        onError: (err) => reject(new Error(friendlyError(err))),
        onSuccess: () => {
          const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
          resolve({ url: pub.publicUrl, path })
        },
      })
      upload.start()
    })().catch((err) => reject(new Error(friendlyError(err))))
  })

  return {
    promise,
    cancel: () => {
      void upload?.abort(true)
    },
  }
}

/**
 * Delete a lesson-media file that's been replaced or removed — unless any
 * lesson, lesson block, or partner bumper still uses it. Best-effort: a
 * failure here never blocks saving.
 */
export async function removeMediaIfUnused(
  supabase: SupabaseClient,
  url: string | null | undefined
): Promise<void> {
  const path = mediaPathFromUrl(url)
  if (!path) return
  try {
    const { data: inUse, error } = await supabase.rpc('lesson_media_in_use', { _path: path })
    if (error || inUse !== false) return
    await supabase.storage.from(MEDIA_BUCKET).remove([path])
  } catch {
    // Leave the file; it's only storage.
  }
}

/** Remove each URL that's no longer used (see removeMediaIfUnused). */
export async function removeMediaListIfUnused(
  supabase: SupabaseClient,
  urls: (string | null | undefined)[]
): Promise<void> {
  const unique = [...new Set(urls.filter((u): u is string => Boolean(mediaPathFromUrl(u))))]
  for (const u of unique) await removeMediaIfUnused(supabase, u)
}
