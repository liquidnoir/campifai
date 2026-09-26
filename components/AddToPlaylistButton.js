'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AddToPlaylistButton({ trackId }) {
  const [open, setOpen] = useState(false)
  const [playlists, setPlaylists] = useState(null) // null = ikke hentet endnu
  const [loading, setLoading] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState('')
  const wrapperRef = useRef(null)

  useEffect(() => {
    function handleOutsideClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  async function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next && playlists === null) {
      setLoading(true)
      const { data } = await supabase.from('playlists').select('id, title').order('created_at', { ascending: false })
      setPlaylists(data || [])
      setLoading(false)
    }
  }

  async function addTo(playlistId) {
    const { error } = await supabase.from('playlist_tracks').insert({ playlist_id: playlistId, track_id: trackId })
    if (error) {
      setFeedback(error.code === '23505' ? 'Ligger allerede på listen.' : 'Kunne ikke tilføje.')
    } else {
      setFeedback('Tilføjet!')
    }
    setTimeout(() => setFeedback(''), 2000)
    setOpen(false)
  }

  async function createAndAdd(e) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    setCreating(true)
    const { data, error } = await supabase.from('playlists').insert({ title }).select().single()
    if (error) {
      setFeedback('Kunne ikke oprette playliste.')
      setCreating(false)
      setTimeout(() => setFeedback(''), 2500)
      return
    }
    await addTo(data.id)
    setPlaylists((prev) => [{ id: data.id, title: data.title }, ...(prev || [])])
    setNewTitle('')
    setCreating(false)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className="btn ghost" onClick={toggleOpen}>
        + Playliste
      </button>
      {open && (
        <div
          className="panel"
          style={{ position: 'absolute', top: '110%', right: 0, zIndex: 20, padding: 10, minWidth: 200 }}
        >
          {loading && <p className="notice">Henter...</p>}
          {!loading && playlists && playlists.length === 0 && (
            <p className="notice" style={{ marginBottom: 8 }}>Du har ingen playlister endnu.</p>
          )}
          {!loading &&
            playlists?.map((p) => (
              <button
                key={p.id}
                type="button"
                className="btn ghost"
                style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }}
                onClick={() => addTo(p.id)}
              >
                {p.title}
              </button>
            ))}
          <form onSubmit={createAndAdd} style={{ marginTop: 8, display: 'flex', gap: 6 }}>
            <input
              placeholder="Ny playliste"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button className="btn" type="submit" disabled={creating || !newTitle.trim()}>
              {creating ? '...' : 'Opret'}
            </button>
          </form>
        </div>
      )}
      {feedback && (
        <div className="notice" style={{ position: 'absolute', top: '110%', right: 0, marginTop: 4, whiteSpace: 'nowrap' }}>
          {feedback}
        </div>
      )}
    </div>
  )
}
