'use client'
import { useRef, useState } from 'react'
import { useLanguage } from './LanguageProvider'
import { controlStyle } from '../lib/shared'
import { fileKey, formatMb, planSelection, titleFromFileName } from '../lib/bulkUpload'

const ACCEPT = '.mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff,audio/*'

// Upload af flere numre til en udgivelse på én gang.
//
// Filerne vælges samlet, sorteres efter filnavn, og hvert nummers titel udfyldes ud fra
// filnavnet — titlen kan rettes, før der uploades. Numrene lægges ind ét ad gangen i
// listens rækkefølge, så nummerrækkefølgen på udgivelsen bliver den samme.
//
//   release:       udgivelsen (bruges til dens kunstner)
//   typeLabel:     udgivelsens type som tekst ("EP"), til beskeder
//   artists:       de kunstnere, publisheren kan vælge imellem
//   existingCount: hvor mange numre udgivelsen allerede har
//   limit:         hvor mange numre udgivelsens type højst må have
//   maxMb:         største filstørrelse i MB
//   uploadOne:     async ({ file, title, artistId, slot }) => ({ ok: true }) | ({ ok: false, message })
//   onFinished:    kaldes, når en omgang er færdig (til at genindlæse udgivelsen)
export default function BulkTrackUpload({
  release,
  typeLabel,
  artists,
  existingCount,
  limit,
  maxMb,
  uploadOne,
  onFinished,
}) {
  const { t, lang } = useLanguage()
  const [queue, setQueue] = useState([]) // { key, file, title, artistId, status, error }
  const [notes, setNotes] = useState([])
  const [message, setMessage] = useState(null) // { type: 'ok' | 'error', text }
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null) // { current, total }
  const inputRef = useRef(null)

  const slotsLeft = Math.max(0, limit - existingCount - queue.length)
  const atLimit = existingCount >= limit
  const pending = queue.filter((item) => item.status !== 'uploading')

  function describeRejected({ file, reason }) {
    if (reason === 'tooBig') {
      return t('dashboard.bulk.skipped.tooBig', { name: file.name, mb: formatMb(file.size, lang), max: maxMb })
    }
    if (reason === 'notAudio') return t('dashboard.bulk.skipped.notAudio', { name: file.name })
    if (reason === 'empty') return t('dashboard.bulk.skipped.empty', { name: file.name })
    return null // dubletter ignoreres stille; "limit" samles i én besked nedenfor
  }

  function handleFiles(event) {
    const chosen = [...event.target.files]
    event.target.value = '' // så de samme filer kan vælges igen senere
    if (chosen.length === 0) return
    setMessage(null)
    const { accepted, rejected } = planSelection({
      files: chosen,
      slots: slotsLeft,
      maxBytes: maxMb * 1024 * 1024,
      seenKeys: new Set(queue.map((item) => item.key)),
    })
    const lines = rejected.map(describeRejected).filter(Boolean)
    const overLimit = rejected.filter((r) => r.reason === 'limit').length
    if (overLimit > 0) {
      lines.push(t('dashboard.bulk.skipped.limit', { count: overLimit, type: typeLabel, limit }))
    }
    setNotes(lines)
    setQueue((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        key: fileKey(file),
        file,
        title: titleFromFileName(file.name),
        artistId: release.artist_id,
        status: 'waiting',
        error: '',
      })),
    ])
  }

  function updateItem(key, changes) {
    setQueue((prev) => prev.map((item) => (item.key === key ? { ...item, ...changes } : item)))
  }

  function removeItem(key) {
    setQueue((prev) => prev.filter((item) => item.key !== key))
  }

  function clearQueue() {
    setQueue([])
    setNotes([])
    setMessage(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy || pending.length === 0) return
    if (pending.some((item) => !item.title.trim())) {
      setMessage({ type: 'error', text: t('dashboard.bulk.needTitles') })
      return
    }
    const batch = [...pending]
    setBusy(true)
    setMessage(null)
    setNotes([])
    let added = 0
    let failed = 0
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i]
      setProgress({ current: i + 1, total: batch.length })
      updateItem(item.key, { status: 'uploading', error: '' })
      let result
      try {
        result = await uploadOne({
          file: item.file,
          title: item.title.trim(),
          artistId: item.artistId,
          slot: existingCount + added,
        })
      } catch (err) {
        result = { ok: false, message: err?.message || t('common.somethingWrong') }
      }
      if (result?.ok) {
        added++
        removeItem(item.key)
      } else {
        failed++
        updateItem(item.key, { status: 'error', error: result?.message || t('common.somethingWrong') })
      }
    }
    setProgress(null)
    setBusy(false)
    setMessage(
      failed === 0
        ? { type: 'ok', text: t(added === 1 ? 'dashboard.bulk.result.ok_one' : 'dashboard.bulk.result.ok_other', { count: added }) }
        : { type: 'error', text: t('dashboard.bulk.result.partial', { ok: added, failed }) }
    )
    await onFinished?.()
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
      <h4 style={{ fontSize: 14, marginBottom: 12 }}>{t('dashboard.bulk.heading')}</h4>

      <div className="field">
        <label>{t('dashboard.bulk.fileLabel')}</label>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          disabled={busy || slotsLeft === 0}
          onChange={handleFiles}
        />
        <div className="notice" style={{ marginTop: 6 }}>{t('dashboard.bulk.hint', { max: maxMb })}</div>
        {!atLimit && slotsLeft > 0 && (
          <div className="notice" style={{ marginTop: 4 }}>
            {t('dashboard.bulk.slotsLeft', { count: slotsLeft, type: typeLabel })}
          </div>
        )}
      </div>

      {atLimit && <div className="error-msg">{t('dashboard.releases.atLimit', { type: typeLabel, limit })}</div>}
      {notes.map((line, i) => (
        <div className="error-msg" key={i}>{line}</div>
      ))}

      {queue.map((item, index) => (
        <div className="panel" key={item.key} style={{ padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field" style={{ margin: 0, flex: '1 1 220px' }}>
              <label>{existingCount + index + 1}. {t('common.title')}</label>
              <input
                value={item.title}
                disabled={busy}
                onChange={(e) => updateItem(item.key, { title: e.target.value })}
              />
            </div>
            {artists.length > 1 && (
              <div className="field" style={{ margin: 0, flex: '1 1 160px' }}>
                <label>{t('dashboard.releases.trackArtist')}</label>
                <select
                  style={controlStyle}
                  disabled={busy}
                  value={item.artistId}
                  onChange={(e) => updateItem(item.key, { artistId: e.target.value })}
                >
                  {artists.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              className="btn ghost"
              type="button"
              disabled={busy}
              aria-label={t('dashboard.bulk.remove')}
              onClick={() => removeItem(item.key)}
            >
              ✕
            </button>
          </div>
          <div className="notice" style={{ marginTop: 6 }}>
            {item.file.name} · {formatMb(item.file.size, lang)} MB
            {item.status === 'uploading' ? ` · ${t('dashboard.bulk.statusUploading')}` : ''}
          </div>
          {item.status === 'error' && <div className="error-msg" style={{ marginTop: 6 }}>{item.error}</div>}
        </div>
      ))}

      {message && (message.type === 'error' ? (
        <div className="error-msg">{message.text}</div>
      ) : (
        <div style={{ color: '#4B5A3E', fontSize: 14, marginBottom: 12 }}>{message.text}</div>
      ))}

      {progress && (
        <div className="notice" style={{ marginBottom: 8 }}>
          {t('dashboard.bulk.uploading', { current: progress.current, total: progress.total })}
        </div>
      )}

      {queue.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" type="submit" disabled={busy || pending.length === 0}>
            {t(pending.length === 1 ? 'dashboard.bulk.upload_one' : 'dashboard.bulk.upload_other', { count: pending.length })}
          </button>
          <button className="btn ghost" type="button" disabled={busy} onClick={clearQueue}>
            {t('dashboard.bulk.clear')}
          </button>
        </div>
      )}
    </form>
  )
}
