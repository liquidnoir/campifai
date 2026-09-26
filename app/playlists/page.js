'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function PlaylistsPage() {
  const router = useRouter()
  const [session, setSession] = useState(undefined)
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (session === null) {
      router.replace('/login')
      return
    }
    load()
  }, [session])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('playlists')
      .select('id, title, created_at, playlist_tracks ( count )')
      .order('created_at', { ascending: false })
    setPlaylists(data || [])
    setLoading(false)
  }

  async function createPlaylist(e) {
    e.preventDefault()
    setError('')
    const title = newTitle.trim()
    if (!title) {
      setError('Angiv et navn til playlisten.')
      return
    }
    setCreating(true)
    const { error: insertError } = await supabase.from('playlists').insert({ title })
    setCreating(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setNewTitle('')
    load()
  }

  async function deletePlaylist(p) {
    if (!window.confirm(`Slet playlisten "${p.title}"? Det kan ikke fortrydes.`)) return
    await supabase.from('playlists').delete().eq('id', p.id)
    load()
  }

  if (session === undefined || loading) return <p className="notice">Henter...</p>

  return (
    <section>
      <h2>Mine playlister</h2>

      <div className="panel" style={{ maxWidth: 480, marginTop: 20, marginBottom: 28 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Opret ny playliste</h3>
        <form onSubmit={createPlaylist}>
          <div className="field">
            <label>Navn</label>
            <input maxLength={100} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn" type="submit" disabled={creating}>
            {creating ? 'Opretter...' : 'Opret playliste'}
          </button>
        </form>
      </div>

      {playlists.length === 0 && (
        <p className="notice">Du har ikke oprettet nogen playlister endnu.</p>
      )}
      {playlists.map((p) => (
        <div className="track-row" key={p.id}>
          <div className="ttitle">
            <Link href={`/playlists/${p.id}`}>{p.title}</Link>
            <div className="notice">{p.playlist_tracks?.[0]?.count ?? 0} numre</div>
          </div>
          <button className="btn ghost" type="button" onClick={() => deletePlaylist(p)}>
            Slet
          </button>
        </div>
      ))}
    </section>
  )
}
