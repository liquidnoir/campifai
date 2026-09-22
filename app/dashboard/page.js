'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import {
  MAX_ARTISTS,
  RELEASE_TYPE_LABELS,
  RELEASE_TYPE_LIMITS,
  canPublish,
  controlStyle,
} from '../../lib/shared'

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

function Msg({ msg }) {
  if (!msg) return null
  return <div className="error-msg">{msg}</div>
}

export default function Dashboard() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [artists, setArtists] = useState([])
  const [releases, setReleases] = useState([])
  const [tracks, setTracks] = useState([])
  const router = useRouter()

  // Kunstnere
  const [newArtistName, setNewArtistName] = useState('')
  const [newArtistBio, setNewArtistBio] = useState('')
  const [artistError, setArtistError] = useState('')
  const [creatingArtist, setCreatingArtist] = useState(false)
  const [editingArtistId, setEditingArtistId] = useState(null)
  const [editArtistName, setEditArtistName] = useState('')
  const [editArtistBio, setEditArtistBio] = useState('')

  // Ny udgivelse pr. kunstner (holdt i et map, så flere kunstnere kan udfyldes uafhængigt)
  const [newRelease, setNewRelease] = useState({}) // { [artistId]: { title, type } }
  const [releaseError, setReleaseError] = useState('')
  const [creatingReleaseFor, setCreatingReleaseFor] = useState(null)
  const [editingReleaseId, setEditingReleaseId] = useState(null)
  const [editReleaseTitle, setEditReleaseTitle] = useState('')
  const [editReleaseType, setEditReleaseType] = useState('single')

  // Upload
  const [uploadReleaseId, setUploadReleaseId] = useState({}) // { [artistId]: releaseId }
  const [title, setTitle] = useState({})
  const [genre, setGenre] = useState({})
  const [file, setFile] = useState({})
  const [uploadError, setUploadError] = useState({})
  const [uploading, setUploading] = useState(null)

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
      await loadAll(session.user.id)
    }
  }

  async function loadAll(uid) {
    const [artistsRes, releasesRes, tracksRes] = await Promise.all([
      supabase.from('artists').select('*').eq('publisher_id', uid).order('created_at', { ascending: true }),
      supabase.from('releases').select('*').eq('publisher_id', uid).order('created_at', { ascending: true }),
      supabase.from('tracks').select('*').eq('publisher_id', uid).order('created_at', { ascending: true }),
    ])
    setArtists(artistsRes.data || [])
    setReleases(releasesRes.data || [])
    setTracks(tracksRes.data || [])
  }

  function releasesFor(artistId) {
    return releases.filter((r) => r.artist_id === artistId)
  }
  function tracksFor(releaseId) {
    return tracks.filter((t) => t.release_id === releaseId)
  }

  // ----- Kunstnere -----
  async function createArtist(e) {
    e.preventDefault()
    setArtistError('')
    const name = newArtistName.trim()
    if (!name) {
      setArtistError('Angiv et navn til kunstneren.')
      return
    }
    if (artists.length >= MAX_ARTISTS) {
      setArtistError(`Du kan højst have ${MAX_ARTISTS} kunstnere.`)
      return
    }
    setCreatingArtist(true)
    const { error } = await supabase
      .from('artists')
      .insert({ publisher_id: session.user.id, name, bio: newArtistBio.trim() || null })
    setCreatingArtist(false)
    if (error) {
      setArtistError(error.message)
      return
    }
    setNewArtistName('')
    setNewArtistBio('')
    loadAll(session.user.id)
  }

  function startEditArtist(a) {
    setArtistError('')
    setEditingArtistId(a.id)
    setEditArtistName(a.name)
    setEditArtistBio(a.bio || '')
  }

  async function saveArtist(a) {
    setArtistError('')
    const name = editArtistName.trim()
    if (!name) {
      setArtistError('Navnet må ikke være tomt.')
      return
    }
    const { error } = await supabase
      .from('artists')
      .update({ name, bio: editArtistBio.trim() || null })
      .eq('id', a.id)
    if (error) {
      setArtistError(error.message)
      return
    }
    setEditingArtistId(null)
    loadAll(session.user.id)
  }

  async function deleteArtist(a) {
    const ownTracks = tracks.filter((t) => t.artist_id === a.id)
    const ownReleases = releasesFor(a.id)
    const question =
      ownReleases.length > 0
        ? `Slet ${a.name}, med ${ownReleases.length} udgivelser og ${ownTracks.length} numre? Det kan ikke fortrydes.`
        : `Slet ${a.name}? Det kan ikke fortrydes.`
    if (!window.confirm(question)) return
    setArtistError('')
    if (ownTracks.length > 0) {
      const { error: removeError } = await supabase.storage
        .from('tracks')
        .remove(ownTracks.map((t) => t.audio_path))
      if (removeError) {
        setArtistError(removeError.message)
        return
      }
    }
    const { error } = await supabase.from('artists').delete().eq('id', a.id)
    if (error) {
      setArtistError(error.message)
      return
    }
    loadAll(session.user.id)
  }

  // ----- Udgivelser -----
  function releaseField(artistId, field, fallback) {
    return newRelease[artistId]?.[field] ?? fallback
  }
  function setReleaseFieldValue(artistId, field, value) {
    setNewRelease((prev) => ({ ...prev, [artistId]: { ...prev[artistId], [field]: value } }))
  }

  async function createRelease(e, artistId) {
    e.preventDefault()
    setReleaseError('')
    const titleValue = releaseField(artistId, 'title', '').trim()
    const type = releaseField(artistId, 'type', 'single')
    if (!titleValue) {
      setReleaseError('Angiv en titel til udgivelsen.')
      return
    }
    setCreatingReleaseFor(artistId)
    const { error } = await supabase
      .from('releases')
      .insert({ publisher_id: session.user.id, artist_id: artistId, title: titleValue, type })
    setCreatingReleaseFor(null)
    if (error) {
      setReleaseError(error.message)
      return
    }
    setNewRelease((prev) => ({ ...prev, [artistId]: { title: '', type: 'single' } }))
    loadAll(session.user.id)
  }

  function startEditRelease(r) {
    setReleaseError('')
    setEditingReleaseId(r.id)
    setEditReleaseTitle(r.title)
    setEditReleaseType(r.type)
  }

  async function saveRelease(r) {
    setReleaseError('')
    const titleValue = editReleaseTitle.trim()
    if (!titleValue) {
      setReleaseError('Titlen må ikke være tom.')
      return
    }
    const currentCount = tracksFor(r.id).length
    if (editReleaseType !== r.type && currentCount > RELEASE_TYPE_LIMITS[editReleaseType]) {
      setReleaseError(
        `Udgivelsen har ${currentCount} numre, hvilket er for mange til typen ${RELEASE_TYPE_LABELS[editReleaseType]}.`
      )
      return
    }
    const { error } = await supabase
      .from('releases')
      .update({ title: titleValue, type: editReleaseType })
      .eq('id', r.id)
    if (error) {
      setReleaseError(error.message)
      return
    }
    setEditingReleaseId(null)
    loadAll(session.user.id)
  }

  async function deleteRelease(r) {
    const own = tracksFor(r.id)
    const question =
      own.length > 0
        ? `Slet "${r.title}" og de ${own.length} numre? Det kan ikke fortrydes.`
        : `Slet "${r.title}"? Det kan ikke fortrydes.`
    if (!window.confirm(question)) return
    setReleaseError('')
    if (own.length > 0) {
      const { error: removeError } = await supabase.storage
        .from('tracks')
        .remove(own.map((t) => t.audio_path))
      if (removeError) {
        setReleaseError(removeError.message)
        return
      }
    }
    const { error } = await supabase.from('releases').delete().eq('id', r.id)
    if (error) {
      setReleaseError(error.message)
      return
    }
    loadAll(session.user.id)
  }

  // ----- Upload -----
  function handleFileChange(releaseId, e) {
    const chosen = e.target.files[0] || null
    setUploadError((prev) => ({ ...prev, [releaseId]: '' }))
    if (chosen && chosen.size > MAX_UPLOAD_BYTES) {
      setFile((prev) => ({ ...prev, [releaseId]: null }))
      e.target.value = ''
      setUploadError((prev) => ({ ...prev, [releaseId]: tooBigMessage(chosen.size) }))
      return
    }
    setFile((prev) => ({ ...prev, [releaseId]: chosen }))
  }

  async function handleUpload(e, release) {
    e.preventDefault()
    const form = e.target
    const releaseId = release.id
    setUploadError((prev) => ({ ...prev, [releaseId]: '' }))
    const titleValue = (title[releaseId] || '').trim()
    const chosenFile = file[releaseId]
    if (!titleValue || !chosenFile) {
      setUploadError((prev) => ({ ...prev, [releaseId]: 'Angiv en titel og vælg en lydfil.' }))
      return
    }
    if (chosenFile.size > MAX_UPLOAD_BYTES) {
      setUploadError((prev) => ({ ...prev, [releaseId]: tooBigMessage(chosenFile.size) }))
      return
    }
    if (tracksFor(releaseId).length >= RELEASE_TYPE_LIMITS[release.type]) {
      setUploadError((prev) => ({
        ...prev,
        [releaseId]: `Denne ${RELEASE_TYPE_LABELS[release.type]} har nået grænsen på ${RELEASE_TYPE_LIMITS[release.type]} numre.`,
      }))
      return
    }
    setUploading(releaseId)
    const path = `${session.user.id}/${Date.now()}-${safeFileName(chosenFile.name)}`
    const { error: uploadErr } = await supabase.storage.from('tracks').upload(path, chosenFile)
    if (uploadErr) {
      const message = /maximum allowed size|too large|exceeded/i.test(uploadErr.message)
        ? tooBigMessage(chosenFile.size)
        : uploadErr.message
      setUploadError((prev) => ({ ...prev, [releaseId]: message }))
      setUploading(null)
      return
    }
    const color = COLORS[tracksFor(releaseId).length % COLORS.length]
    const { error: insertError } = await supabase.from('tracks').insert({
      release_id: releaseId,
      // artist_id og publisher_id bliver sat automatisk ud fra udgivelsen
      title: titleValue,
      genre: (genre[releaseId] || '').trim(),
      audio_path: path,
      color,
    })
    if (insertError) {
      await supabase.storage.from('tracks').remove([path])
      setUploadError((prev) => ({ ...prev, [releaseId]: insertError.message }))
      setUploading(null)
      return
    }
    setTitle((prev) => ({ ...prev, [releaseId]: '' }))
    setGenre((prev) => ({ ...prev, [releaseId]: '' }))
    setFile((prev) => ({ ...prev, [releaseId]: null }))
    form.reset()
    setUploading(null)
    loadAll(session.user.id)
  }

  async function handleDeleteTrack(t) {
    await supabase.storage.from('tracks').remove([t.audio_path])
    await supabase.from('tracks').delete().eq('id', t.id)
    loadAll(session.user.id)
  }

  if (session === undefined || (session && !profile)) return <p className="notice">Henter...</p>
  if (!profile) return null

  if (!canPublish(profile.role)) {
    return (
      <section>
        <h2>Udgivelser</h2>
        <p className="notice" style={{ marginTop: 12 }}>
          Du er logget ind som lytter. Kun publishers kan oprette kunstnere og udgive musik. Opret en
          konto som publisher, eller bed en admin om at ændre din rolle.
        </p>
      </section>
    )
  }

  const artistLimitReached = artists.length >= MAX_ARTISTS

  return (
    <section>
      <h2>Udgivelser — {profile.display_name}</h2>

      <div className="panel" style={{ marginTop: 20, marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>
          Mine kunstnere ({artists.length} / {MAX_ARTISTS})
        </h3>
        <p className="notice" style={{ marginBottom: 16 }}>
          Opret en kunstner for hver, du udgiver musik for.
        </p>

        {artists.length === 0 && (
          <p className="notice" style={{ marginBottom: 16 }}>Du har ikke oprettet nogen kunstnere endnu.</p>
        )}

        {artists.map((a) =>
          editingArtistId === a.id ? (
            <div key={a.id} style={{ marginBottom: 16 }}>
              <div className="field">
                <label>Navn</label>
                <input maxLength={80} value={editArtistName} onChange={(e) => setEditArtistName(e.target.value)} />
              </div>
              <div className="field">
                <label>Om kunstneren</label>
                <textarea
                  maxLength={500}
                  value={editArtistBio}
                  onChange={(e) => setEditArtistBio(e.target.value)}
                  style={{ ...controlStyle, minHeight: 72, resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" type="button" onClick={() => saveArtist(a)}>
                  Gem ændringer
                </button>
                <button className="btn ghost" type="button" onClick={() => setEditingArtistId(null)}>
                  Annuller
                </button>
              </div>
            </div>
          ) : (
            <div className="track-row" key={a.id}>
              <div className="ttitle">
                <Link href={`/artist/${a.id}`}>{a.name}</Link>
                {a.bio && <div className="notice">{a.bio}</div>}
                <div className="notice">{releasesFor(a.id).length} udgivelser</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" type="button" onClick={() => startEditArtist(a)}>
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
              value={newArtistName}
              onChange={(e) => setNewArtistName(e.target.value)}
              disabled={artistLimitReached}
            />
          </div>
          <div className="field">
            <label>Om kunstneren (valgfrit)</label>
            <textarea
              maxLength={500}
              value={newArtistBio}
              onChange={(e) => setNewArtistBio(e.target.value)}
              disabled={artistLimitReached}
              style={{ ...controlStyle, minHeight: 72, resize: 'vertical' }}
            />
          </div>
          {artistLimitReached && (
            <div className="error-msg">
              Du har nået grænsen på {MAX_ARTISTS} kunstnere. Slet en, hvis du vil oprette en ny.
            </div>
          )}
          <Msg msg={artistError} />
          <button className="btn" type="submit" disabled={creatingArtist || artistLimitReached}>
            {creatingArtist ? 'Opretter...' : 'Opret kunstner'}
          </button>
        </form>
      </div>

      {artists.length === 0 ? (
        <p className="notice">Opret en kunstner ovenfor for at komme i gang med udgivelser.</p>
      ) : (
        artists.map((a) => {
          const artistReleases = releasesFor(a.id)
          return (
            <div className="panel" key={a.id} style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 4 }}>{a.name} — udgivelser</h3>
              <p className="notice" style={{ marginBottom: 16 }}>
                Et Album kan have op til {RELEASE_TYPE_LIMITS.album} numre, en EP op til{' '}
                {RELEASE_TYPE_LIMITS.ep}, og en Single præcis {RELEASE_TYPE_LIMITS.single}.
              </p>

              {artistReleases.length === 0 && (
                <p className="notice" style={{ marginBottom: 16 }}>Ingen udgivelser endnu.</p>
              )}

              {artistReleases.map((r) => {
                const releaseTracks = tracksFor(r.id)
                const limit = RELEASE_TYPE_LIMITS[r.type]
                const atLimit = releaseTracks.length >= limit
                return (
                  <div key={r.id} style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                    {editingReleaseId === r.id ? (
                      <div>
                        <div className="field">
                          <label>Titel</label>
                          <input
                            maxLength={120}
                            value={editReleaseTitle}
                            onChange={(e) => setEditReleaseTitle(e.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label>Type</label>
                          <select
                            style={controlStyle}
                            value={editReleaseType}
                            onChange={(e) => setEditReleaseType(e.target.value)}
                          >
                            {Object.entries(RELEASE_TYPE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <Msg msg={releaseError} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn" type="button" onClick={() => saveRelease(r)}>
                            Gem ændringer
                          </button>
                          <button className="btn ghost" type="button" onClick={() => setEditingReleaseId(null)}>
                            Annuller
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="section-head">
                        <div>
                          <strong>{r.title}</strong>
                          <span className="notice" style={{ marginLeft: 8 }}>
                            {RELEASE_TYPE_LABELS[r.type]} · {releaseTracks.length}/{limit} numre
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn ghost" type="button" onClick={() => startEditRelease(r)}>
                            Redigér
                          </button>
                          <button className="btn ghost" type="button" onClick={() => deleteRelease(r)}>
                            Slet
                          </button>
                        </div>
                      </div>
                    )}

                    {releaseTracks.map((t) => (
                      <div className="track-row" key={t.id}>
                        <div className="ttitle">
                          {t.title}
                          <div className="notice">{t.genre}</div>
                        </div>
                        <button className="btn ghost" onClick={() => handleDeleteTrack(t)}>
                          Slet
                        </button>
                      </div>
                    ))}

                    {editingReleaseId !== r.id && (
                      <form onSubmit={(e) => handleUpload(e, r)} style={{ marginTop: 12 }}>
                        <div className="field">
                          <label>Titel på nummer</label>
                          <input
                            disabled={atLimit}
                            value={title[r.id] || ''}
                            onChange={(e) => setTitle((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          />
                        </div>
                        <div className="field">
                          <label>Genre</label>
                          <input
                            disabled={atLimit}
                            value={genre[r.id] || ''}
                            onChange={(e) => setGenre((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            placeholder="fx Ambient, Pop, Rock"
                          />
                        </div>
                        <div className="field">
                          <label>Lydfil</label>
                          <input
                            type="file"
                            accept="audio/*"
                            disabled={atLimit}
                            onChange={(e) => handleFileChange(r.id, e)}
                          />
                          <div className="notice" style={{ marginTop: 6 }}>
                            Maks. {MAX_UPLOAD_MB} MB. MP3 og FLAC fylder langt mindre end WAV.
                          </div>
                        </div>
                        {atLimit && (
                          <div className="error-msg">
                            Denne {RELEASE_TYPE_LABELS[r.type]} har nået grænsen på {limit} numre.
                          </div>
                        )}
                        <Msg msg={uploadError[r.id]} />
                        <button className="btn" type="submit" disabled={atLimit || uploading === r.id}>
                          {uploading === r.id ? 'Uploader...' : 'Tilføj nummer'}
                        </button>
                      </form>
                    )}
                  </div>
                )
              })}

              <form onSubmit={(e) => createRelease(e, a.id)} style={{ marginTop: 8 }}>
                <h4 style={{ fontSize: 15, marginBottom: 12 }}>Opret ny udgivelse</h4>
                <div className="field">
                  <label>Titel</label>
                  <input
                    maxLength={120}
                    value={releaseField(a.id, 'title', '')}
                    onChange={(e) => setReleaseFieldValue(a.id, 'title', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Type</label>
                  <select
                    style={controlStyle}
                    value={releaseField(a.id, 'type', 'single')}
                    onChange={(e) => setReleaseFieldValue(a.id, 'type', e.target.value)}
                  >
                    {Object.entries(RELEASE_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label} (op til {RELEASE_TYPE_LIMITS[value]} numre)
                      </option>
                    ))}
                  </select>
                </div>
                <Msg msg={releaseError} />
                <button className="btn" type="submit" disabled={creatingReleaseFor === a.id}>
                  {creatingReleaseFor === a.id ? 'Opretter...' : 'Opret udgivelse'}
                </button>
              </form>
            </div>
          )
        })
      )}
    </section>
  )
}
