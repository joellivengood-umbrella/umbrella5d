'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Per-partner audio bumper control for the admin panel. Uploads a short
 * "Brought to you by …" clip to the public 'lesson-media' bucket (admins can
 * write there) and stores its URL on the partner via the set_partner_bumper
 * definer RPC. Lets the admin preview the current bumper or remove it.
 *
 * The bumper itself plays as a content pre-roll for the partner's members —
 * that lives in a separate change; this is just the attach/detach surface.
 */
const MAX_BYTES = 5 * 1024 * 1024 // a 4s clip is tiny; this is a generous ceiling

export function PartnerBumperManager({
  partnerId,
  initialBumperUrl,
}: {
  partnerId: string
  initialBumperUrl: string | null
}) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [bumperUrl, setBumperUrl] = useState<string | null>(initialBumperUrl)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<
    { type: 'success' | 'error'; msg: string } | null
  >(null)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      setStatus({ type: 'error', msg: 'Please choose an audio file.' })
      e.target.value = ''
      return
    }
    if (file.size > MAX_BYTES) {
      setStatus({ type: 'error', msg: 'Bumper must be under 5 MB.' })
      e.target.value = ''
      return
    }

    setBusy(true)
    setStatus(null)

    const dot = file.name.lastIndexOf('.')
    const ext = (dot > 0 ? file.name.slice(dot + 1) : 'mp3').toLowerCase()
    const tag = crypto.randomUUID().slice(0, 8)
    const path = `partner-bumper/${partnerId}-${tag}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('lesson-media')
      .upload(path, file, { upsert: false, contentType: file.type })
    if (upErr) {
      setBusy(false)
      setStatus({ type: 'error', msg: upErr.message })
      e.target.value = ''
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('lesson-media').getPublicUrl(path)

    const { error: rpcErr } = await supabase.rpc('set_partner_bumper', {
      _partner_id: partnerId,
      _url: publicUrl,
    })

    setBusy(false)
    e.target.value = ''
    if (rpcErr) {
      console.error('set_partner_bumper error', rpcErr)
      setStatus({ type: 'error', msg: 'Could not save the bumper. Try again.' })
      return
    }
    setBumperUrl(publicUrl)
    setStatus({ type: 'success', msg: 'Bumper saved.' })
  }

  async function handleRemove() {
    setBusy(true)
    setStatus(null)
    const { error } = await supabase.rpc('set_partner_bumper', {
      _partner_id: partnerId,
      _url: null,
    })
    setBusy(false)
    if (error) {
      console.error('set_partner_bumper (remove) error', error)
      setStatus({ type: 'error', msg: 'Could not remove the bumper. Try again.' })
      return
    }
    setBumperUrl(null)
    setStatus({ type: 'success', msg: 'Bumper removed.' })
  }

  return (
    <div className="partner-bumper">
      {bumperUrl ? (
        <>
          <audio className="partner-bumper__audio" src={bumperUrl} controls preload="none" />
          <div className="partner-bumper__actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              {busy ? 'Working…' : 'Replace'}
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm partner-bumper__remove"
              onClick={handleRemove}
              disabled={busy}
            >
              Remove
            </button>
          </div>
        </>
      ) : (
        <div className="partner-bumper__actions">
          <span className="partner-bumper__none">No bumper</span>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            {busy ? 'Uploading…' : 'Add bumper'}
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {status && (
        <span
          className={`settings-status settings-status--${status.type}`}
          role={status.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {status.msg}
        </span>
      )}
      <p className="partner-bumper__hint">
        Short audio (≈4s), MP3/M4A/WAV. Plays before content audio for this
        partner&rsquo;s members — except 5D Machine.
      </p>
    </div>
  )
}
