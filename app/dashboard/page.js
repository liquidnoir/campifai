'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import {
  MAX_ARTISTS,
  MAX_IMAGE_MB,
  RELEASE_TYPE_LABELS,
  RELEASE_TYPE_LIMITS,
  canPublish,
  controlStyle,
  imagePublicUrl,
  removeImage,
  safeFileName,
  uploadImage,
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

function Msg({ msg }) {
  if (!msg) return null
  return <div className="error-msg">{msg}</div>
}

function ImagePicker({ label, currentUrl, onChange, disabled }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {currentUrl && (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              backgroundImage: `url(${currentUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              flexShrink: 0,
            }}
          />
        )}
        <input type="file" accept="image/*" disabled={disabled} onChange={onChange} />
      </div>
      <div className="notice" style={{ marginTop: 4 }}>Maks. {MAX_IMAGE_MB} MB. Valgfrit.</div>
    </div>
  )
}

function Thumb({ url, color, radius = 8 }) {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: radius,
        flexShrink: 0,
        background: url ? undefined : color || '#B8452B',
        backgroundImage: url ? `url(${url})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
  )
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
  const [newArtistImage, setNewArtistImage] = useState(null)
  const [artistError, setArtistError] = useState('')
  const [creatingArtist, setCreatingArtist] = useState(false)
  const [editingArtistId, setEditingArtistId] = useState(null)
  const [editArtistName, setEditArtistName] = useState('')
  const [editArtistBio, setEditArtistBio] = useState('')
  const [editArtistImage, setEditArtistImage] = useState(null)
  const [savingArtist, setSavingArtist] = useState(false)

  // Ny udgivelse
  const [newReleaseArtistId, setNewReleaseArtistId] = useState('')
  const [newReleaseTitle, setNewReleaseTitle] = useState('')
  const [newReleaseType, setNewReleaseType] = useState('single')
  const [newReleaseImage, setNewReleaseImage] = useState(null)
  const [creatingRelease, setCreatingRelease] = useState(false)
  const [releaseError, setReleaseError] = useState('')

  // Redigering af en udgivelse (titel/type/cover + numre)
  const [editingReleaseId, setEditingReleaseId] = useState(null)
  const [editReleaseTitle, setEditReleaseTitle] = useState('')
  const [editReleaseType, setEditReleaseType] = useState('single')
  const [editReleaseImage, setEditReleaseImage] = useState(null)
  const [savingRelease, setSavingRelease] = useState(false)

  // Redigering af numre inde i en udgivelse
  const [trackEdits, setTrackEdits] = useState({}) // { [trackId]: { title, genre } }
  const [savingTrackId, setSavingTrackId] = useState(null)
  const [newTrackTitle, setNewTrackTitle] = useState('')
  const [newTrackGenre, setNewTrackGenre] = useState('')
  const [newTrackFile, setNewTrackFile] = useState(null)
  const [trackUploadError, setTrackUploadError] = useState('')
  const [uploadingTrack, setUploadingTrack] = useState(false)

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
      supabase.from('artists').select('*').eq('publisher_id', uid).order('name', { ascending: true }),
      supabase
        .from('releases')
        .select('*, artists ( name )')
        .eq('publisher_id', uid)
        .order('created_at', { ascending: false }),
      supabase.from('tracks').select('*').eq('publisher_id', uid).order('created_at', { ascending: true }),
    ])
    const artistList = artistsRes.data || []
    setArtists(artistList)
    setReleases(releasesRes.data || [])
    setTracks(tracksRes.data || [])
    setNewReleaseArtistId((current) =>
      current && artistList.some((a) => a.id === current) ? current : artistList[0]?.id || ''
    )
  }

  function tracksFor(releaseId) {
    return tracks.filter((t) => t.release_id === releaseId)
  }

  function pickImage(setter) {
    return (e) => {
      const chosen = e.target.files[0] || null
      if (chosen && !chosen.type.startsWith('image/')) {
        e.target.value = ''
        setter(null)
        return
      }
      setter(chosen)
    }
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
    try {
      const { data: created, error } = await supabase
        .from('artists')
        .insert({ publisher_id: session.user.id, name, bio: newArtistBio.trim() || null })
        .select()
        .single()
      if (error) throw error

      if (newArtistImage) {
        const path = await uploadImage(supabase, session.user.id, 'artist', newArtistImage)
        const { error: updateError } = await supabase.from('artists').update({ image_path: path }).eq('id', created.id)
        if (updateError) throw updateError
      }

      setNewArtistName('')
      setNewArtistBio('')
      setNewArtistImage(null)
      loadAll(session.user.id)
    } catch (err) {
      setArtistError(err.message || 'Noget gik galt. Prøv igen.')
    }
    setCreatingArtist(false)
  }

  function startEditArtist(a) {
    setArtistError('')
    setEditingArtistId(a.id)
    setEditArtistName(a.name)
    setEditArtistBio(a.bio || '')
    setEditArtistImage(null)
  }

  async function saveArtist(a) {
    setArtistError('')
    const name = editArtistName.trim()
    if (!name) {
      setArtistError('Navnet må ikke være tomt.')
      return
    }
    setSavingArtist(true)
    try {
      const changes = { name, bio: editArtistBio.trim() || null }
      if (editArtistImage) {
        const path = await uploadImage(supabase, session.user.id, 'artist', editArtistImage)
        changes.image_path = path
      }
      const { error } = await supabase.from('artists').update(changes).eq('id', a.id)
      if (error) throw error
      if (editArtistImage && a.image_path) {
        await removeImage(supabase, a.image_path)
      }
      setEditingArtistId(null)
      loadAll(session.user.id)
    } catch (err) {
      setArtistError(err.message || 'Noget gik galt. Prøv igen.')
    }
    setSavingArtist(false)
  }

  async function deleteArtist(a) {
    const ownTracks = tracks.filter((t) => t.artist_id === a.id)
    const ownReleases = releases.filter((r) => r.artist_id === a.id)
    const question =
      ownReleases.length > 0
        ? `Slet ${a.name}, med ${ownReleases.length} udgivelser og ${ownTracks.length} numre? Det kan ikke fortrydes.`
        : `Slet ${a.name}? Det kan ikke fortrydes.`
    if (!window.confirm(question)) return
    setArtistError('')
    try {
      if (ownTracks.length > 0) {
        const { error: removeError } = await supabase.storage
          .from('tracks')
          .remove(ownTracks.map((t) => t.audio_path))
        if (removeError) throw removeError
      }
      const coverPaths = ownReleases.map((r) => r.cover_path).filter(Boolean)
      const imagePaths = [a.image_path, ...coverPaths].filter(Boolean)
      if (imagePaths.length > 0) {
        await supabase.storage.from('images').remove(imagePaths)
      }
      const { error } = await supabase.from('artists').delete().eq('id', a.id)
      if (error) throw error
      loadAll(session.user.id)
    } catch (err) {
      setArtistError(err.message || 'Noget gik galt. Prøv igen.')
    }
  }

  // ----- Udgivelser -----
  async function createRelease(e) {
    e.preventDefault()
    setReleaseError('')
    const titleValue = newReleaseTitle.trim()
    if (!newReleaseArtistId) {
      setReleaseError('Vælg en kunstner.')
      return
    }
    if (!titleValue) {
      setReleaseError('Angiv en titel til udgivelsen.')
      return
    }
    setCreatingRelease(true)
    try {
      const { data: created, error } = await supabase
        .from('releases')
        .insert({
          publisher_id: session.user.id,
          artist_id: newReleaseArtistId,
          title: titleValue,
          type: newReleaseType,
        })
        .select()
        .single()
      if (error) throw error

      if (newReleaseImage) {
        const path = await uploadImage(supabase, session.user.id, 'release', newReleaseImage)
        const { error: updateError } = await supabase.from('releases').update({ cover_path: path }).eq('id', created.id)
        if (updateError) throw updateError
      }

      setNewReleaseTitle('')
      setNewReleaseType('single')
      setNewReleaseImage(null)
      loadAll(session.user.id)
    } catch (err) {
      setReleaseError(err.message || 'Noget gik galt. Prøv igen.')
    }
    setCreatingRelease(false)
  }

  function startEditRelease(r) {
    setReleaseError('')
    setEditingReleaseId(r.id)
    setEditReleaseTitle(r.title)
    setEditReleaseType(r.type)
    setEditReleaseImage(null)
    setTrackEdits({})
    setNewTrackTitle('')
    setNewTrackGenre('')
    setNewTrackFile(null)
    setTrackUploadError('')
  }

  function closeEditRelease() {
    setEditingReleaseId(null)
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
    setSavingRelease(true)
    try {
      const changes = { title: titleValue, type: editReleaseType }
      if (editReleaseImage) {
        const path = await uploadImage(supabase, session.user.id, 'release', editReleaseImage)
        changes.cover_path = path
      }
      const { error } = await supabase.from('releases').update(changes).eq('id', r.id)
      if (error) throw error
      if (editReleaseImage && r.cover_path) {
        await removeImage(supabase, r.cover_path)
      }
      setEditReleaseImage(null)
      loadAll(session.user.id)
    } catch (err) {
      setReleaseError(err.message || 'Noget gik galt. Prøv igen.')
    }
    setSavingRelease(false)
  }

  async function deleteRelease(r) {
    const own = tracksFor(r.id)
    const question =
      own.length > 0
        ? `Slet "${r.title}" og de ${own.length} numre? Det kan ikke fortrydes.`
        : `Slet "${r.title}"? Det kan ikke fortrydes.`
    if (!window.confirm(question)) return
    setReleaseError('')
    try {
      if (own.length > 0) {
        const { error: removeError } = await supabase.storage
          .from('tracks')
          .remove(own.map((t) => t.audio_path))
        if (removeError) throw removeError
      }
      if (r.cover_path) {
        await supabase.storage.from('images').remove([r.cover_path])
      }
      const { error } = await supabase.from('releases').delete().eq('id', r.id)
      if (error) throw error
      if (editingReleaseId === r.id) setEditingReleaseId(null)
      loadAll(session.user.id)
    } catch (err) {
      setReleaseError(err.message || 'Noget gik galt. Prøv igen.')
    }
  }

  // ----- Numre (kun synlige/redigerbare inde i en åben udgivelse) -----
  function trackValue(t, field) {
    return trackEdits[t.id]?.[field] ?? t[field] ?? ''
  }
  function setTrackField(t, field, value) {
    setTrackEdits((prev) => ({ ...prev, [t.id]: { ...prev[t.id], [field]: value } }))
  }
  function trackDirty(t) {
    const e = trackEdits[t.id]
    if (!e) return false
    const titleChanged = e.title !== undefined && e.title.trim() !== t.title
    const genreChanged = e.genre !== undefined && e.genre.trim() !== (t.genre || '')
    return titleChanged || genreChanged
  }

  async function saveTrack(t) {
    const title = trackValue(t, 'title').trim()
    if (!title) {
      setTrackUploadError('Titlen må ikke være tom.')
      return
    }
    setSavingTrackId(t.id)
    const { error } = await supabase
      .from('tracks')
      .update({ title, genre: trackValue(t, 'genre').trim() })
      .eq('id', t.id)
    setSavingTrackId(null)
    if (error) {
      setTrackUploadError(error.message)
      return
    }
    setTrackEdits((prev) => {
      const next = { ...prev }
      delete next[t.id]
      return next
    })
    loadAll(session.user.id)
  }

  async function deleteTrack(t) {
    if (!window.confirm(`Slet "${t.title}"? Det kan ikke fortrydes.`)) return
    await supabase.storage.from('tracks').remove([t.audio_path])
    await supabase.from('tracks').delete().eq('id', t.id)
    loadAll(session.user.id)
  }

  function handleNewTrackFile(e) {
    const chosen = e.target.files[0] || null
    setTrackUploadError('')
    if (chosen && chosen.size > MAX_UPLOAD_BYTES) {
      setNewTrackFile(null)
      e.target.value = ''
      setTrackUploadError(tooBigMessage(chosen.size))
      return
    }
    setNewTrackFile(chosen)
  }

  async function handleUploadTrack(e, release) {
    e.preventDefault()
    const form = e.target
    setTrackUploadError('')
    const titleValue = newTrackTitle.trim()
    if (!titleValue || !newTrackFile) {
      setTrackUploadError('Angiv en titel og vælg en lydfil.')
      return
    }
    if (newTrackFile.size > MAX_UPLOAD_BYTES) {
      setTrackUploadError(tooBigMessage(newTrackFile.size))
      return
    }
    const existing = tracksFor(release.id)
    if (existing.length >= RELEASE_TYPE_LIMITS[release.type]) {
      setTrackUploadError(
        `Denne ${RELEASE_TYPE_LABELS[release.type]} har nået grænsen på ${RELEASE_TYPE_LIMITS[release.type]} numre.`
      )
      return
    }
    setUploadingTrack(true)
    const path = `${session.user.id}/${Date.now()}-${safeFileName(newTrackFile.name)}`
    const { error: uploadErr } = await supabase.storage.from('tracks').upload(path, newTrackFile)
    if (uploadErr) {
      const message = /maximum allowed size|too large|exceeded/i.test(uploadErr.message)
        ? tooBigMessage(newTrackFile.size)
        : uploadErr.message
      setTrackUploadError(message)
      setUploadingTrack(false)
      return
    }
    const color = COLORS[existing.length % COLORS.length]
    const { error: insertError } = await supabase.from('tracks').insert({
      release_id: release.id,
      title: titleValue,
      genre: newTrackGenre.trim(),
      audio_path: path,
      color,
    })
    if (insertError) {
      await supabase.storage.from('tracks').remove([path])
      setTrackUploadError(insertError.message)
      setUploadingTrack(false)
      return
    }
    setNewTrackTitle('')
    setNewTrackGenre('')
    setNewTrackFile(null)
    form.reset()
    setUploadingTrack(false)
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

      {/* ----- Mine kunstnere ----- */}
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
              <ImagePicker
                label="Billede"
                currentUrl={imagePublicUrl(supabase, a.image_path)}
                onChange={pickImage(setEditArtistImage)}
                disabled={savingArtist}
              />
              <Msg msg={artistError} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" type="button" disabled={savingArtist} onClick={() => saveArtist(a)}>
                  {savingArtist ? 'Gemmer...' : 'Gem ændringer'}
                </button>
                <button className="btn ghost" type="button" onClick={() => setEditingArtistId(null)}>
                  Annuller
                </button>
              </div>
            </div>
          ) : (
            <div className="track-row" key={a.id}>
              <div className="ttitle" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {a.image_path && <Thumb url={imagePublicUrl(supabase, a.image_path)} radius={999} />}
                <div>
                  <Link href={`/artist/${a.id}`}>{a.name}</Link>
                  {a.bio && <div className="notice">{a.bio}</div>}
                  <div className="notice">{releases.filter((r) => r.artist_id === a.id).length} udgivelser</div>
                </div>
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
          <ImagePicker
            label="Billede"
            currentUrl={null}
            onChange={pickImage(setNewArtistImage)}
            disabled={artistLimitReached}
          />
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

      {/* ----- Mine udgivelser ----- */}
      <div className="panel" style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>Mine udgivelser ({releases.length})</h3>
        <p className="notice" style={{ marginBottom: 16 }}>
          Et Album kan have op til {RELEASE_TYPE_LIMITS.album} numre, en EP op til {RELEASE_TYPE_LIMITS.ep},
          og en Single præcis {RELEASE_TYPE_LIMITS.single}.
        </p>

        {releases.length === 0 && (
          <p className="notice" style={{ marginBottom: 16 }}>Du har ikke oprettet nogen udgivelser endnu.</p>
        )}

        {releases.map((r) => {
          const releaseTracks = tracksFor(r.id)
          const limit = RELEASE_TYPE_LIMITS[r.type]
          const atLimit = releaseTracks.length >= limit
          const isEditing = editingReleaseId === r.id

          return (
            <div key={r.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
              <div className="track-row" style={{ borderBottom: 'none', padding: '4px' }}>
                <div className="ttitle" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Thumb url={imagePublicUrl(supabase, r.cover_path)} color={r.color} />
                  <div>
                    <Link href={`/release/${r.id}`}>{r.title}</Link>
                    <div className="notice">
                      {r.artists?.name || 'Ukendt kunstner'} · {RELEASE_TYPE_LABELS[r.type]} ·{' '}
                      {releaseTracks.length}/{limit} numre
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => (isEditing ? closeEditRelease() : startEditRelease(r))}
                  >
                    {isEditing ? 'Luk' : 'Redigér'}
                  </button>
                  <button className="btn ghost" type="button" onClick={() => deleteRelease(r)}>
                    Slet
                  </button>
                </div>
              </div>

              {isEditing && (
                <div style={{ marginTop: 12, paddingLeft: 4 }}>
                  <div className="field">
                    <label>Titel</label>
                    <input maxLength={120} value={editReleaseTitle} onChange={(e) => setEditReleaseTitle(e.target.value)} />
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
                  <ImagePicker
                    label="Cover art"
                    currentUrl={imagePublicUrl(supabase, r.cover_path)}
                    onChange={pickImage(setEditReleaseImage)}
                    disabled={savingRelease}
                  />
                  <Msg msg={releaseError} />
                  <button className="btn" type="button" disabled={savingRelease} onClick={() => saveRelease(r)}>
                    {savingRelease ? 'Gemmer...' : 'Gem ændringer'}
                  </button>

                  <h4 style={{ fontSize: 14, margin: '24px 0 12px' }}>Numre</h4>
                  {releaseTracks.length === 0 && (
                    <p className="notice" style={{ marginBottom: 12 }}>Ingen numre endnu.</p>
                  )}
                  {releaseTracks.map((t) => (
                    <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 10, flexWrap: 'wrap' }}>
                      <div className="field" style={{ margin: 0, flex: '1 1 160px' }}>
                        <label>Titel</label>
                        <input value={trackValue(t, 'title')} onChange={(e) => setTrackField(t, 'title', e.target.value)} />
                      </div>
                      <div className="field" style={{ margin: 0, flex: '1 1 120px' }}>
                        <label>Genre</label>
                        <input value={trackValue(t, 'genre')} onChange={(e) => setTrackField(t, 'genre', e.target.value)} />
                      </div>
                      <button
                        className="btn ghost"
                        type="button"
                        disabled={!trackDirty(t) || savingTrackId === t.id}
                        onClick={() => saveTrack(t)}
                      >
                        {savingTrackId === t.id ? 'Gemmer...' : 'Gem'}
                      </button>
                      <button className="btn ghost" type="button" onClick={() => deleteTrack(t)}>
                        Slet
                      </button>
                    </div>
                  ))}

                  <form onSubmit={(e) => handleUploadTrack(e, r)} style={{ marginTop: 16 }}>
                    <h4 style={{ fontSize: 14, marginBottom: 12 }}>Tilføj nummer</h4>
                    <div className="field">
                      <label>Titel</label>
                      <input disabled={atLimit} value={newTrackTitle} onChange={(e) => setNewTrackTitle(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Genre</label>
                      <input
                        disabled={atLimit}
                        value={newTrackGenre}
                        onChange={(e) => setNewTrackGenre(e.target.value)}
                        placeholder="fx Ambient, Pop, Rock"
                      />
                    </div>
                    <div className="field">
                      <label>Lydfil</label>
                      <input type="file" accept="audio/*" disabled={atLimit} onChange={handleNewTrackFile} />
                      <div className="notice" style={{ marginTop: 6 }}>
                        Maks. {MAX_UPLOAD_MB} MB. MP3 og FLAC fylder langt mindre end WAV.
                      </div>
                    </div>
                    {atLimit && (
                      <div className="error-msg">
                        Denne {RELEASE_TYPE_LABELS[r.type]} har nået grænsen på {limit} numre.
                      </div>
                    )}
                    <Msg msg={trackUploadError} />
                    <button className="btn" type="submit" disabled={atLimit || uploadingTrack}>
                      {uploadingTrack ? 'Uploader...' : 'Tilføj nummer'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )
        })}

        {artists.length === 0 ? (
          <p className="notice" style={{ marginTop: 8 }}>
            Opret en kunstner ovenfor, før du kan oprette en udgivelse.
          </p>
        ) : (
          <form onSubmit={createRelease} style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 15, marginBottom: 12 }}>Opret ny udgivelse</h4>
            <div className="field">
              <label>Kunstner</label>
              <select style={controlStyle} value={newReleaseArtistId} onChange={(e) => setNewReleaseArtistId(e.target.value)}>
                {artists.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Titel</label>
              <input maxLength={120} value={newReleaseTitle} onChange={(e) => setNewReleaseTitle(e.target.value)} />
            </div>
            <div className="field">
              <label>Type</label>
              <select style={controlStyle} value={newReleaseType} onChange={(e) => setNewReleaseType(e.target.value)}>
                {Object.entries(RELEASE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label} (op til {RELEASE_TYPE_LIMITS[value]} numre)
                  </option>
                ))}
              </select>
            </div>
            <ImagePicker label="Cover art" currentUrl={null} onChange={pickImage(setNewReleaseImage)} />
            <Msg msg={releaseError} />
            <button className="btn" type="submit" disabled={creatingRelease}>
              {creatingRelease ? 'Opretter...' : 'Opret udgivelse'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
