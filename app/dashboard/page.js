'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { MAX_ARTISTS, canPublish, controlStyle } from '../../lib/shared'

const COLORS = ['#4B5A3E', '#B8452B', '#D89A2E', '#221F19']

// Supabase gratis-plan tillader højst 50 MB pr. fil.
// Opgraderer du planen (og hæver grænsen under Storage → Settings), kan du ændre tallet her.
const MAX_UPLOAD_MB = 50
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

function tooBigMessage(bytes) {
  const mb = (bytes / 1024 / 1024).toFixed(1)
  return `Filen er ${mb} MB, og grænsen er ${MAX_UPLOAD_MB} MB. Gem den som MP3 eller FLAC, og vælg den igen.`
}

// Fjerner tegn, som lagringen ikke kan lide (mellemrum, æøå osv.)
function safeFileName(name) {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  const cleanBase =
    base
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'lyd'
  const cleanExt = ext.replace(/[^a-zA-Z0-9.]/g, '').toLowerCase()
  return cleanBase + cleanExt
}

export default function Dashboard() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [artists, setArtists] = useState([])
  const [tracks, setTracks] = useState([])

  // Kunstnere
  const [newName, setNewName] = useState('')
  const [newBio, setNewBio] = useState('')
  const [artistError, setArtistError] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')

  // Upload
  const [artistId, setArtistId] = useState('')
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
    if (data && canPublish(data.role)) {
      await Promise.all([loadArtists(session.user.id), loadTracks(session.user.id)])
    }
  }

  async function loadArtists(uid) {
    const { data } = await supabase
      .from('artists')
      .select('*')
      .eq('publisher_id', uid)
      .order('created_at', { ascending: true })
    const list = data || []
    setArtists(list)
    setArtistId((current) => (current && list.some((a) => a.id === current) ? current : list[0]?.id || ''))
  }

  async function loadTracks(uid) {
    const { data } = await supabase
      .from('tracks')
      .select('*')
      .eq('publisher_id', uid)
      .order('created_at', { ascending: false })
    setTracks(data || [])
  }

  async function createArtist(e) {
    e.preventDefault()
    setArtistError('')
    const name = newName.trim()
    if (!name) {
      setArtistError('Angiv et navn til kunstneren.')
      return
    }
    if (artists.length >= MAX_ARTISTS) {
      setArtistError(`Du kan højst have ${MAX_ARTISTS} kunstnere.`)
      return
    }
    setCreating(true)
    const { error: insertError } = await supabase
      .from('artists')
      .insert({ publisher_id: session.user.id, name, bio: newBio.trim() || null })
    setCreating(false)
    if (insertError) {
      setArtistError(insertError.message)
      return
    }
    setNewName('')
    setNewBio('')
    loadArtists(session.user.id)
  }

  function startEdit(a) {
    setArtistError('')
    setEditingId(a.id)
    setEditName(a.name)
    setEditBio(a.bio || '')
  }

  async function saveArtist(a) {
    setArtistError('')
    const name = editName.trim()
    if (!name) {
      setArtistError('Navnet må ikke være tomt.')
      return
    }
    const { error: updateError } = await supabase
      .from('artists')
      .update({ name, bio: editBio.trim() || null })
      .eq('id', a.id)
    if (updateError) {
      setArtistError(updateError.message)
      return
    }
    setEditingId(null)
    loadArtists(session.user.id)
  }

  async function deleteArtist(a) {
    const own = tracks.filter((t) => t.artist_id === a.id)
    const question =
      own.length > 0
        ? `Slet ${a.name} og de ${own.length} numre? Det kan ikke fortrydes.`
        : `Slet ${a.name}? Det kan ikke fortrydes.`
    if (!window.confirm(question)) return
    setArtistError('')
    if (own.length > 0) {
      const { error: removeError } = await supabase.storage
        .from('tracks')
        .remove(own.map((t) => t.audio_path))
      if (removeError) {
        setArtistError(removeError.message)
        return
      }
    }
    const { error: deleteError } = await supabase.from('artists').delete().eq('id', a.id)
    if (deleteError) {
      setArtistError(deleteError.message)
      return
    }
    await Promise.all([loadArtists(session.user.id), loadTracks(session.user.id)])
  }

  function handleFileChange(e) {
    const chosen = e.target.files[0] || null
    setError('')
    if (chosen && chosen.size > MAX_UPLOAD_BYTES) {
      setFile(null)
      e.target.value = ''
      setError(tooBigMessage(chosen.size))
      return
    }
    setFile(chosen)
  }

  async function handleUpload(e) {
    e.preventDefault()
    const form = e.target
    setError('')
    if (!artistId) {
      setError('Vælg en kunstner, eller opret en først.')
      return
    }
    if (!title.trim() || !file) {
      setError('Angiv en titel og vælg en lydfil.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(tooBigMessage(file.size))
      return
    }
    setUploading(true)
    const path = `${session.user.id}/${Date.now()}-${safeFileName(file.name)}`
    const { error: uploadError } = await supabase.storage.from('tracks').upload(path, file)
    if (uploadError) {
      if (/maximum allowed size|too large|exceeded/i.test(uploadError.message)) {
        setError(tooBigMessage(file.size))
      } else {
        setError(uploadError.message)
      }
      setUploading(false)
      return
    }
    const color = COLORS[tracks.length % COLORS.length]
    const { error: insertError } = await supabase.from('tracks').insert({
      publisher_id: session.user.id,
      artist_id: artistId,
      title: title.trim(),
      genre: genre.trim(),
      audio_path: path,
      color,
    })
    if (insertError) {
      await supabase.storage.from('tracks').remove([path])
      setError(insertError.message)
      setUploading(false)
      return
    }
    setTitle('')
    setGenre('')
    setFile(null)
    form.reset()
    setUploading(false)
    loadTracks(session.user.id)
  }

  async function handleDelete(track) {
    await supabase.storage.from('tracks').remove([track.audio_path])
    await supabase.from('tracks').delete().eq('id', track.id)
    loadTracks(session.user.id)
  }

  if (session === undefined || (session && !profile)) return <p className="notice">Henter...</p>
  if (!profile) return null

  if (!canPublish(profile.role)) {
    return (
      <section>
        <h2>Mit kontor</h2>
        <p className="notice" style={{ marginTop: 12 }}>
          Du er logget ind som lytter. Kun publishers kan uploade musik. Opret en konto som publisher,
          eller bed en admin om at ændre din rolle.
        </p>
      </section>
    )
  }

  const limitReached = artists.length >= MAX_ARTISTS

  return (
    <section>
      <h2>Mit kontor — {profile.display_name}</h2>

      <div className="panel" style={{ marginTop: 20, marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>
          Mine kunstnere ({artists.length} / {MAX_ARTISTS})
        </h3>
        <p className="notice" style={{ marginBottom: 16 }}>
          Opret en kunstner for hver, du udgiver musik for. Numrene vises under kunstnerens navn.
        </p>

        {artists.length === 0 && (
          <p className="notice" style={{ marginBottom: 16 }}>Du har ikke oprettet nogen kunstnere endnu.</p>
        )}

        {artists.map((a) =>
          editingId === a.id ? (
            <div key={a.id} style={{ marginBottom: 16 }}>
              <div className="field">
                <label>Navn</label>
                <input maxLength={80} value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="field">
                <label>Om kunstneren</label>
                <textarea
                  maxLength={500}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  style={{ ...controlStyle, minHeight: 72, resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" type="button" onClick={() => saveArtist(a)}>
                  Gem ændringer
                </button>
                <button className="btn ghost" type="button" onClick={() => setEditingId(null)}>
                  Annuller
                </button>
              </div>
            </div>
          ) : (
            <div className="track-row" key={a.id}>
              <div className="ttitle">
                <Link href={`/artist/${a.id}`}>{a.name}</Link>
                {a.bio && <div className="notice">{a.bio}</div>}
                <div className="notice">
                  {tracks.filter((t) => t.artist_id === a.id).length} numre
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" type="button" onClick={() => startEdit(a)}>
                  Redigér
                </button>
                <button className="btn ghost" type="button" onClick={() => deleteArtist(a)}>
                  Slet
                </button>
              </div>
            </div>
          )
        )}

        <form onSubmit={createArtist} style={{ marginTop: 20 }}>
          <h4 style={{ fontSize: 15, marginBottom: 12 }}>Opret ny kunstner</h4>
          <div className="field">
            <label>Navn</label>
            <input
              maxLength={80}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={limitReached}
            />
          </div>
          <div className="field">
            <label>Om kunstneren (valgfrit)</label>
            <textarea
              maxLength={500}
              value={newBio}
              onChange={(e) => setNewBio(e.target.value)}
              disabled={limitReached}
              style={{ ...controlStyle, minHeight: 72, resize: 'vertical' }}
            />
          </div>
          {limitReached && (
            <div className="error-msg">
              Du har nået grænsen på {MAX_ARTISTS} kunstnere. Slet en, hvis du vil oprette en ny.
            </div>
          )}
          {artistError && <div className="error-msg">{artistError}</div>}
          <button className="btn" type="submit" disabled={creating || limitReached}>
            {creating ? 'Opretter...' : 'Opret kunstner'}
          </button>
        </form>
      </div>

      <div className="panel" style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>Upload et nyt nummer</h3>
        {artists.length === 0 ? (
          <p className="notice">Opret en kunstner ovenfor, før du kan uploade et nummer.</p>
        ) : (
          <form onSubmit={handleUpload}>
            <div className="field">
              <label>Kunstner</label>
              <select
                value={artistId}
                onChange={(e) => setArtistId(e.target.value)}
                style={controlStyle}
              >
                {artists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Titel</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label>Genre</label>
              <input
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="fx Ambient, Pop, Rock"
              />
            </div>
            <div className="field">
              <label>Lydfil</label>
              <input type="file" accept="audio/*" onChange={handleFileChange} />
              <div className="notice" style={{ marginTop: 6 }}>
                Maks. {MAX_UPLOAD_MB} MB. MP3 og FLAC fylder langt mindre end WAV.
              </div>
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button className="btn" type="submit" disabled={uploading}>
              {uploading ? 'Uploader...' : 'Udgiv nummer'}
            </button>
          </form>
        )}
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 8 }}>Mine numre ({tracks.length})</h3>
      {tracks.length === 0 && <p className="notice">Du har ikke uploadet noget endnu.</p>}
      {artists
        .filter((a) => tracks.some((t) => t.artist_id === a.id))
        .map((a) => (
          <div key={a.id} style={{ marginBottom: 16 }}>
            <div className="notice" style={{ marginTop: 8 }}>{a.name}</div>
            {tracks
              .filter((t) => t.artist_id === a.id)
              .map((t) => (
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
          </div>
        ))}
    </section>
  )
}
