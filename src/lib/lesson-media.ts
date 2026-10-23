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

/** Status code + server message from a failed TUS request, when there is one. */
function tusDetail(err: unknown): { status: number | null; text: string } {
  const res = (err as { originalResponse?: { getStatus(): number; getBody(): string } | null })
    ?.originalResponse
  let text = ''
  try {
    const body = res?.getBody() ?? ''
    // Storage answers with JSON like {"statusCode":"403","error":…,"message":…}.
    const parsed = body ? (JSON.parse(body) as { message?: string; error?: string }) : null
    text = parsed?.message || parsed?.error || body
  } catch {
    text = res?.getBody() ?? ''
  }
  return { status: res?.getStatus() ?? null, text: text || (err instanceof Error ? err.message : String(err)) }
}

/** A plain-English reason, always followed by Storage's own words. */
function friendlyError(status: number | null, text: string): string {
  const detail = ` (Storage said: ${status ? `${status} ` : ''}${text.slice(0, 200)})`
  if (status === 413 || /too large|maximum allowed size|exceeded/i.test(text)) {
    return `This file is larger than your storage plan currently allows. Raise the upload size limit in Supabase (Storage → Settings), then try again.${detail}`
  }
  if (status === 415 || /mime|content type/i.test(text)) {
    return `This file type isn’t allowed in the media bucket.${detail}`
  }
  if (status === 401 || status === 403) {
    return `Storage refused the upload.${detail}`
  }
  if (status == null && /network|failed to fetch|offline|ProgressEvent/i.test(text)) {
    return `The connection dropped and the upload couldn’t finish. Please try again.${detail}`
  }
  return `Upload failed.${detail}`
}

/**
 * Supabase recommends its dedicated storage host for large uploads:
 * https://<ref>.supabase.co → https://<ref>.storage.supabase.co
 */
function resumableEndpoint(): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const direct = base.replace(/^https:\/\/([a-z0-9]+)\.supabase\.co$/i, 'https://$1.storage.supabase.co')
  return `${direct}/storage/v1/upload/resumable`
}

/**
 * Upload a file into `folder`. Resumable and chunked (TUS) with progress
 * 0–100; if Storage refuses the chunked upload, retries once as a plain
 * single-request upload (no live progress) before giving up. Resolves with
 * the public URL; rejects with a message that includes Storage's reason.
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
  const contentType = file.type || 'application/octet-stream'
  let upload: tus.Upload | null = null
  let cancelled = false

  const publicUrl = () => supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl

  // The one-request upload the editor used before chunking (same permissions).
  async function plainUpload(): Promise<{ url: string; path: string }> {
    onProgress?.(0)
    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { upsert: false, contentType, cacheControl: '3600' })
    if (error) {
      const status = Number((error as { statusCode?: string | number }).statusCode) || null
      throw new Error(friendlyError(status, error.message))
    }
    onProgress?.(100)
    return { url: publicUrl(), path }
  }

  const promise = new Promise<{ url: string; path: string }>((resolve, reject) => {
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        reject(new Error('Please sign in again, then retry the upload.'))
        return
      }
      upload = new tus.Upload(file, {
        endpoint: resumableEndpoint(),
        retryDelays: [0, 3000, 5000, 10000, 20000],
        chunkSize: CHUNK_SIZE,
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        headers: {
          authorization: `Bearer ${data.session.access_token}`,
          'x-upsert': 'false',
        },
        metadata: {
          bucketName: MEDIA_BUCKET,
          objectName: path,
          contentType,
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
        onError: (err) => {
          if (cancelled) return
          const { status, text } = tusDetail(err)
          console.error('Resumable upload failed', status, text, err)
          // Too big or a dropped connection won't be fixed by retrying in one
          // piece; anything else (e.g. a refused chunked upload) gets one try.
          if (status === 413 || status === 415 || status == null) {
            reject(new Error(friendlyError(status, text)))
            return
          }
          plainUpload().then(resolve, (plainErr: Error) => {
            reject(new Error(`${plainErr.message} [chunked upload: ${status ?? ''} ${text.slice(0, 120)}]`))
          })
        },
        onSuccess: () => resolve({ url: publicUrl(), path }),
      })
      upload.start()
    })().catch((err) => reject(new Error(friendlyError(null, err instanceof Error ? err.message : String(err)))))
  })

  return {
    promise,
    cancel: () => {
      cancelled = true
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
