'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { useLanguage } from './LanguageProvider'
import { usePlayer } from './PlayerProvider'

// Én "⋯"-knap pr. nummerrække med alt, man kan gøre ved nummeret: afspil som næste, læg i kø, tilføj til
// playliste, start radio (hvis genre er angivet) og del. Erstatter fire separate knapper pr. række,
// så titlen får plads på en smal skærm.
//   track: nummeret (se PlayerProvider). releaseId bruges til delingslinket.
//   genre: valgfri — viser "Start radio" for genren
export default function TrackMenu({ track, genre }) {
  const { t } = useLanguage()
  const player = usePlayer()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState('main') // 'main' | 'playlists' | 'share'
  const [upward, setUpward] = useState(false)
  const [playlists, setPlaylists] = useState(null) // null = ikke hentet endnu
  const [loading, setLoading] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState('')
  const wrapperRef = useRef(null)
  const buttonRef = useRef(null)
  const timerRef = useRef(null)

  const sharePath = track.releaseId ? `/release/${track.releaseId}?t=${track.id}` : ''
  const shareTitle = `${track.title}${(track.mediaArtist || track.artistName) ? ` — ${track.mediaArtist || track.artistName}` : ''}`

  useEffect(() => () => clearTimeout(timerRef.current), [])

  // Luk ved tryk udenfor og med Escape
  useEffect(() => {
    if (!open) return undefined
    function handlePointerDown(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) close()
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        close()
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function close() {
    setOpen(false)
    setView('main')
  }

  function say(text) {
    setFeedback(text)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setFeedback(''), 2200)
  }

  function toggle() {
    if (!open) {
      const rect = buttonRef.current.getBoundingClientRect()
      setUpward(window.innerHeight - rect.bottom < 300)
    }
    if (open) setView('main')
    setOpen((value) => !value)
  }

  function fullUrl() {
    return window.location.origin + sharePath
  }

  async function openPlaylists() {
    setView('playlists')
    if (playlists === null) {
      setLoading(true)
      const { data } = await supabase.from('playlists').select('id, title').order('created_at', { ascending: false })
      setPlaylists(data || [])
      setLoading(false)
    }
  }

  async function addToPlaylist(playlistId) {
    const { error } = await supabase.from('playlist_tracks').insert({ playlist_id: playlistId, track_id: track.id })
    say(error ? (error.code === '23505' ? t('playlistAdd.alreadyOnList') : t('playlistAdd.couldNotAdd')) : t('playlistAdd.added'))
    close()
  }

  async function createAndAdd(event) {
    event.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    setCreating(true)
    const { data, error } = await supabase.from('playlists').insert({ title }).select().single()
    if (error) {
      say(t('playlistAdd.couldNotCreate'))
      setCreating(false)
      return
    }
    setPlaylists((prev) => [{ id: data.id, title: data.title }, ...(prev || [])])
    setNewTitle('')
    setCreating(false)
    await addToPlaylist(data.id)
  }

  async function share() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      close()
      try {
        await navigator.share({ title: shareTitle, url: fullUrl() })
      } catch {
        // Brugeren annullerede delingen — ikke en fejl
      }
      return
    }
    setView('share')
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(fullUrl())
      say(t('share.copied'))
    } catch {
      say(t('share.copyFailed'))
    }
    close()
  }

  function shareViaSms() {
    window.location.href = `sms:?body=${encodeURIComponent(`${shareTitle} ${fullUrl()}`)}`
    close()
  }

  function queue(where) {
    close()
    if (where === 'next') player.playNext(track)
    else player.addToQueue(track)
  }

  return (
    <div ref={wrapperRef} className="tm-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="btn ghost tm-btn"
        aria-label={t('trackMenu.open', { title: track.title })}
        title={t('trackMenu.openShort')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {open && (
        <div role="menu" className="panel tm-menu" style={upward ? { bottom: '110%' } : { top: '110%' }}>
          {view === 'main' && (
            <>
              {track.url && (
                <>
                  <button type="button" role="menuitem" className="tm-item" onClick={() => queue('next')}>
                    {t('queue.playNext')}
                  </button>
                  <button type="button" role="menuitem" className="tm-item" onClick={() => queue('end')}>
                    {t('queue.addToQueue')}
                  </button>
                </>
              )}
              <button type="button" role="menuitem" className="tm-item" onClick={openPlaylists}>
                {t('trackMenu.addToPlaylist')}
              </button>
              {genre && (
                <Link
                  role="menuitem"
                  className="tm-item"
                  href={`/radio?genre=${encodeURIComponent(genre)}&from=${track.id}`}
                  onClick={close}
                >
                  {t('trackMenu.radio')}
                </Link>
              )}
              {sharePath && (
                <button type="button" role="menuitem" className="tm-item" onClick={share}>
                  {t('release.shareTrack')}
                </button>
              )}
            </>
          )}

          {view === 'playlists' && (
            <>
              <button type="button" className="tm-item tm-back" onClick={() => setView('main')}>
                ← {t('trackMenu.back')}
              </button>
              {loading && <p className="notice tm-note">{t('common.loading')}</p>}
              {!loading && playlists && playlists.length === 0 && <p className="notice tm-note">{t('playlistAdd.none')}</p>}
              {!loading &&
                playlists?.map((p) => (
                  <button key={p.id} type="button" className="tm-item" onClick={() => addToPlaylist(p.id)}>
                    {p.title}
                  </button>
                ))}
              <form onSubmit={createAndAdd} className="tm-form">
                <input
                  placeholder={t('playlistAdd.newPlaceholder')}
                  aria-label={t('playlistAdd.newPlaceholder')}
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                />
                <button className="btn" type="submit" disabled={creating || !newTitle.trim()}>
                  {creating ? '...' : t('common.create')}
                </button>
              </form>
            </>
          )}

          {view === 'share' && (
            <>
              <button type="button" className="tm-item tm-back" onClick={() => setView('main')}>
                ← {t('trackMenu.back')}
              </button>
              <button type="button" className="tm-item" onClick={shareViaSms}>
                {t('share.viaSms')}
              </button>
              <button type="button" className="tm-item" onClick={copyLink}>
                {t('share.copyLink')}
              </button>
            </>
          )}
        </div>
      )}

      {feedback && (
        <div className="notice tm-feedback" role="status" aria-live="polite">
          {feedback}
        </div>
      )}
    </div>
  )
}
