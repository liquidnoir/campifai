'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const COLORS = ['#4B5A3E', '#B8452B', '#D89A2E', '#221F19']

export default function Dashboard() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [myTracks, setMyTracks] = useState([])
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (session === null) {
      router.push('/login')
      return
    }
    loadProfile()
  }, [session])

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setProfile(data)
    if (data?.role === 'artist') loadMyTracks(session.user.id)
  }

  async function loadMyTracks(artistId) {
    const { data } = await supabase
      .from('tracks')
      .select('*')
      .eq('artist_id', artistId)
      .order('created_at', { ascending: false })
    setMyTracks(data || [])
  }

  async function handleUpload(e) {
    e.preventDefault()
    setError('')
    if (!title.trim() || !file) {
      setError('Angiv en titel og vælg en lydfil.')
      return
    }
    setUploading(true)
    const path = `${session.user.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('tracks').upload(path, file)
    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }
    const color = COLORS[myTracks.length % COLORS.length]
    const { error: insertError } = await supabase.from('tracks').insert({
      artist_id: session.user.id,
      title: title.trim(),
      genre: genre.trim(),
      audio_path: path,
      color,
    })
    if (insertError) {
      setError(insertError.message)
      setUploading(false)
      return
    }
    setTitle('')
    setGenre('')
    setFile(null)
    e.target.reset()
    setUploading(false)
    loadMyTracks(session.user.id)
  }

  async function handleDelete(track) {
    await supabase.storage.from('tracks').remove([track.audio_path])
    await supabase.from('tracks').delete().eq('id', track.id)
    loadMyTracks(session.user.id)
  }

  if (session === undefined || (session && !profile)) return <p className="notice">Henter...</p>
  if (!profile) return null

  if (profile.role !== 'artist') {
    return (
      <section>
        <h2>Mit kontor</h2>
        <p className="notice" style={{ marginTop: 12 }}>
          Du er logget ind som lytter. Opret en kunstnerkonto for at kunne uploade musik.
        </p>
      </section>
    )
  }

  return (
    <section>
      <h2>Mit kontor — {profile.display_name}</h2>

      <div className="panel" style={{ marginTop: 20, marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>Upload et nyt nummer</h3>
        <form onSubmit={handleUpload}>
          <div className="field">
            <label>Titel</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>Genre</label>
            <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="fx Ambient, Pop, Rock" />
          </div>
          <div className="field">
            <label>Lydfil</label>
            <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files[0])} />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn" type="submit" disabled={uploading}>
            {uploading ? 'Uploader...' : 'Udgiv nummer'}
          </button>
        </form>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 8 }}>Mine numre ({myTracks.length})</h3>
      {myTracks.length === 0 && <p className="notice">Du har ikke uploadet noget endnu.</p>}
      {myTracks.map((t) => (
        <div className="track-row" key={t.id}>
          <div className="ttitle">
            {t.title}
            <div className="notice">{t.genre}</div>
          </div>
          <button className="btn ghost" onClick={() => handleDelete(t)}>
            Slet
          </button>
        </div>
      ))}
    </section>
  )
}
