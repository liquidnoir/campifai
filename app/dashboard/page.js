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
  imageTooBigMessage,
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

  // Ny udgivelse pr. kunstner
  const [newRelease, setNewRelease] = useState({}) // { [artistId]: { title, type, image } }
  const [releaseError, setReleaseError] = useState('')
  const [creatingReleaseFor, setCreatingReleaseFor] = useState(null)
  const [editingReleaseId, setEditingReleaseId] = useState(null)
  const [editReleaseTitle, setEditReleaseTitle] = useState('')
  const [editReleaseType, setEditReleaseType] = useState('single')
  const [editReleaseImage, setEditReleaseImage] = useState(null)
  const [savingRelease, setSavingRelease] = useState(false)

  // Upload af numre
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

  function pickImage(setter, maxMb) {
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
    const ownReleases = releasesFor(a.id)
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
    const imageFile = releaseField(artistId, 'image', null)
    if (!titleValue) {
      setReleaseError('Angiv en titel til udgivelsen.')
      return
    }
    setCreatingReleaseFor(artistId)
    try {
      const { data: created, error } = await supabase
        .from('releases')
        .insert({ publisher_id: session.user.id, artist_id: artistId, title: titleValue, type })
        .select()
        .single()
      if (error) throw error

      if (imageFile) {
        const path = await uploadImage(supabase, session.user.id, 'release', imageFile)
        const { error: updateError } = await supabase.from('releases').update({ cover_path: path }).eq('id', created.id)
        if (updateError) throw updateError
      }

      setNewRelease((prev) => ({ ...prev, [artistId]: { title: '', type: 'single', image: null } }))
      loadAll(session.user.id)
    } catch (err) {
      setReleaseError(err.message || 'Noget gik galt. Prøv igen.')
    }
    setCreatingReleaseFor(null)
  }

  function startEditRelease(r) {
    setReleaseError('')
    setEditingReleaseId(r.id)
    setEditReleaseTitle(r.title)
    setEditReleaseType(r.type)
    setEditReleaseImage(null)
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
      setEditingReleaseId(null)
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
      loadAll(session.user.id)
    } catch (err) {
      setReleaseError(err.message || 'Noget gik galt. Prøv igen.')
    }
  }

  // ----- Upload af numre -----
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
                {a.image_path && (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      flexShrink: 0,
                      backgroundImage: `url(${imagePublicUrl(supabase, a.image_path)})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                )}
                <div>
                  <Link href={`/artist/${a.id}`}>{a.name}</Link>
                  {a.bio && <div className="notice">{a.bio}</div>}
                  <div className="notice">{releasesFor(a.id).length} udgivelser</div>
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
                        <ImagePicker
                          label="Cover art"
                          currentUrl={imagePublicUrl(supabase, r.cover_path)}
                          onChange={pickImage(setEditReleaseImage)}
                          disabled={savingRelease}
                        />
                        <Msg msg={releaseError} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn" type="button" disabled={savingRelease} onClick={() => saveRelease(r)}>
                            {savingRelease ? 'Gemmer...' : 'Gem ændringer'}
                          </button>
                          <button className="btn ghost" type="button" onClick={() => setEditingReleaseId(null)}>
                            Annuller
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="section-head">
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {r.cover_path && (
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 6,
                                flexShrink: 0,
                                backgroundImage: `url(${imagePublicUrl(supabase, r.cover_path)})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                              }}
                            />
                          )}
                          <div>
                            <Link href={`/release/${r.id}`}><strong>{r.title}</strong></Link>
                            <span className="notice" style={{ marginLeft: 8 }}>
                              {RELEASE_TYPE_LABELS[r.type]} · {releaseTracks.length}/{limit} numre
                            </span>
                          </div>
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
                <ImagePicker
                  label="Cover art"
                  currentUrl={null}
                  onChange={pickImage((f) => setReleaseFieldValue(a.id, 'image', f))}
                />
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
