'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import {
  MAX_ARTISTS,
  MAX_IMAGE_MB,
  RELEASE_TYPE_LIMITS,
  canPublish,
  controlStyle,
  imagePublicUrl,
  removeImage,
  safeFileName,
  uploadImage,
} from '../../lib/shared'
import { useLanguage } from '../../components/LanguageProvider'

const COLORS = ['#4B5A3E', '#B8452B', '#D89A2E', '#221F19']
const RELEASE_TYPES = Object.keys(RELEASE_TYPE_LIMITS)

// Supabase gratis-plan tillader højst 50 MB pr. fil.
// Opgraderer du planen (og hæver grænsen under Storage → Settings), kan du ændre tallet her.
const MAX_UPLOAD_MB = 50
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

function tooBigMessage(bytes, t) {
  const mb = (bytes / 1024 / 1024).toFixed(1)
  return t('dashboard.fileTooBig', { mb, max: MAX_UPLOAD_MB })
}

function Msg({ msg }) {
  if (!msg) return null
  return <div className="error-msg">{msg}</div>
}

function ImagePicker({ label, currentUrl, onChange, disabled, hint }) {
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
      <div className="notice" style={{ marginTop: 4 }}>{hint}</div>
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
  const { t } = useLanguage()
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
  const [newReleaseGenre, setNewReleaseGenre] = useState('')
  const [newReleaseImage, setNewReleaseImage] = useState(null)
  const [creatingRelease, setCreatingRelease] = useState(false)
  const [releaseError, setReleaseError] = useState('')

  // Redigering af en udgivelse (titel/type/cover + numre)
  const [editingReleaseId, setEditingReleaseId] = useState(null)
  const [editReleaseTitle, setEditReleaseTitle] = useState('')
  const [editReleaseType, setEditReleaseType] = useState('single')
  const [editReleaseGenre, setEditReleaseGenre] = useState('')
  const [editReleaseImage, setEditReleaseImage] = useState(null)
  const [savingRelease, setSavingRelease] = useState(false)

  // Redigering af numre inde i en udgivelse
  const [trackEdits, setTrackEdits] = useState({}) // { [trackId]: { title } }
  const [savingTrackId, setSavingTrackId] = useState(null)
  const [newTrackTitle, setNewTrackTitle] = useState('')
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
      setArtistError(t('dashboard.artists.nameRequired'))
      return
    }
    if (artists.length >= MAX_ARTISTS) {
      setArtistError(t('dashboard.artists.limitError', { max: MAX_ARTISTS }))
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
        const path = await uploadImage(supabase, session.user.id, 'artist', newArtistImage, t)
        const { error: updateError } = await supabase.from('artists').update({ image_path: path }).eq('id', created.id)
        if (updateError) throw updateError
      }

      setNewArtistName('')
      setNewArtistBio('')
      setNewArtistImage(null)
      loadAll(session.user.id)
    } catch (err) {
      setArtistError(err.message || t('common.somethingWrong'))
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
      setArtistError(t('account.nameEmpty'))
      return
    }
    setSavingArtist(true)
    try {
      const changes = { name, bio: editArtistBio.trim() || null }
      if (editArtistImage) {
        const path = await uploadImage(supabase, session.user.id, 'artist', editArtistImage, t)
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
      setArtistError(err.message || t('common.somethingWrong'))
    }
    setSavingArtist(false)
  }

  async function deleteArtist(a) {
    const ownTracks = tracks.filter((t) => t.artist_id === a.id)
    const ownReleases = releases.filter((r) => r.artist_id === a.id)
    const question =
      ownReleases.length > 0
        ? t('dashboard.artists.deleteConfirmWithContent', {
            name: a.name,
            releases: ownReleases.length,
            tracks: ownTracks.length,
          })
        : t('dashboard.deleteConfirmNamed', { name: a.name })
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
      setArtistError(err.message || t('common.somethingWrong'))
    }
  }

  // ----- Udgivelser -----
  async function createRelease(e) {
    e.preventDefault()
    setReleaseError('')
    const titleValue = newReleaseTitle.trim()
    if (!newReleaseArtistId) {
      setReleaseError(t('dashboard.releases.selectArtist'))
      return
    }
    if (!titleValue) {
      setReleaseError(t('dashboard.releases.titleRequired'))
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
          genre: newReleaseGenre.trim() || null,
        })
        .select()
        .single()
      if (error) throw error

      if (newReleaseImage) {
        const path = await uploadImage(supabase, session.user.id, 'release', newReleaseImage, t)
        const { error: updateError } = await supabase.from('releases').update({ cover_path: path }).eq('id', created.id)
        if (updateError) throw updateError
      }

      setNewReleaseTitle('')
      setNewReleaseType('single')
      setNewReleaseGenre('')
      setNewReleaseImage(null)
      loadAll(session.user.id)
    } catch (err) {
      setReleaseError(err.message || t('common.somethingWrong'))
    }
    setCreatingRelease(false)
  }

  function startEditRelease(r) {
    setReleaseError('')
    setEditingReleaseId(r.id)
    setEditReleaseTitle(r.title)
    setEditReleaseType(r.type)
    setEditReleaseGenre(r.genre || '')
    setEditReleaseImage(null)
    setTrackEdits({})
    setNewTrackTitle('')
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
      setReleaseError(t('dashboard.releases.titleEmpty'))
      return
    }
    const currentCount = tracksFor(r.id).length
    if (editReleaseType !== r.type && currentCount > RELEASE_TYPE_LIMITS[editReleaseType]) {
      setReleaseError(
        t('dashboard.releases.tooManyForType', { count: currentCount, type: t(`type.${editReleaseType}`) })
      )
      return
    }
    setSavingRelease(true)
    try {
      const changes = { title: titleValue, type: editReleaseType, genre: editReleaseGenre.trim() || null }
      if (editReleaseImage) {
        const path = await uploadImage(supabase, session.user.id, 'release', editReleaseImage, t)
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
      setReleaseError(err.message || t('common.somethingWrong'))
    }
    setSavingRelease(false)
  }

  async function deleteRelease(r) {
    const own = tracksFor(r.id)
    const question =
      own.length > 0
        ? t('dashboard.releases.deleteConfirmWithTracks', { title: r.title, count: own.length })
        : t('dashboard.deleteConfirmTitled', { title: r.title })
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
      setReleaseError(err.message || t('common.somethingWrong'))
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
    return e.title !== undefined && e.title.trim() !== t.title
  }

  async function saveTrack(tr) {
    const title = trackValue(tr, 'title').trim()
    if (!title) {
      setTrackUploadError(t('dashboard.releases.titleEmpty'))
      return
    }
    setSavingTrackId(tr.id)
    const { error } = await supabase.from('tracks').update({ title }).eq('id', tr.id)
    setSavingTrackId(null)
    if (error) {
      setTrackUploadError(error.message)
      return
    }
    setTrackEdits((prev) => {
      const next = { ...prev }
      delete next[tr.id]
      return next
    })
    loadAll(session.user.id)
  }

  async function deleteTrack(tr) {
    if (!window.confirm(t('dashboard.deleteConfirmTitled', { title: tr.title }))) return
    await supabase.storage.from('tracks').remove([tr.audio_path])
    await supabase.from('tracks').delete().eq('id', tr.id)
    loadAll(session.user.id)
  }

  function handleNewTrackFile(e) {
    const chosen = e.target.files[0] || null
    setTrackUploadError('')
    if (chosen && chosen.size > MAX_UPLOAD_BYTES) {
      setNewTrackFile(null)
      e.target.value = ''
      setTrackUploadError(tooBigMessage(chosen.size, t))
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
      setTrackUploadError(t('dashboard.tracks.needTitleAndFile'))
      return
    }
    if (newTrackFile.size > MAX_UPLOAD_BYTES) {
      setTrackUploadError(tooBigMessage(newTrackFile.size, t))
      return
    }
    const existing = tracksFor(release.id)
    if (existing.length >= RELEASE_TYPE_LIMITS[release.type]) {
      setTrackUploadError(
        t('dashboard.releases.atLimit', { type: t(`type.${release.type}`), limit: RELEASE_TYPE_LIMITS[release.type] })
      )
      return
    }
    setUploadingTrack(true)
    const path = `${session.user.id}/${Date.now()}-${safeFileName(newTrackFile.name)}`
    const { error: uploadErr } = await supabase.storage.from('tracks').upload(path, newTrackFile)
    if (uploadErr) {
      const message = /maximum allowed size|too large|exceeded/i.test(uploadErr.message)
        ? tooBigMessage(newTrackFile.size, t)
        : uploadErr.message
      setTrackUploadError(message)
      setUploadingTrack(false)
      return
    }
    const color = COLORS[existing.length % COLORS.length]
    const { error: insertError } = await supabase.from('tracks').insert({
      release_id: release.id,
      title: titleValue,
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
    setNewTrackFile(null)
    form.reset()
    setUploadingTrack(false)
    loadAll(session.user.id)
  }

  if (session === undefined || (session && !profile)) return <p className="notice">{t('common.loading')}</p>
  if (!profile) return null

  if (!canPublish(profile.role)) {
    return (
      <section>
        <h2>{t('nav.releases')}</h2>
        <p className="notice" style={{ marginTop: 12 }}>{t('dashboard.listenerBlocked')}</p>
      </section>
    )
  }

  const artistLimitReached = artists.length >= MAX_ARTISTS

  return (
    <section>
      <h2>{t('nav.releases')} — {profile.display_name}</h2>

      {/* ----- Mine kunstnere ----- */}
      <div className="panel" style={{ marginTop: 20, marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>
          {t('dashboard.artists.title', { count: artists.length, max: MAX_ARTISTS })}
        </h3>
        <p className="notice" style={{ marginBottom: 16 }}>{t('dashboard.artists.subtitle')}</p>

        {artists.length === 0 && (
          <p className="notice" style={{ marginBottom: 16 }}>{t('dashboard.artists.empty')}</p>
        )}

        {artists.map((a) =>
          editingArtistId === a.id ? (
            <div key={a.id} style={{ marginBottom: 16 }}>
              <div className="field">
                <label>{t('signup.name')}</label>
                <input maxLength={80} value={editArtistName} onChange={(e) => setEditArtistName(e.target.value)} />
              </div>
              <div className="field">
                <label>{t('dashboard.artists.bio')}</label>
                <textarea
                  maxLength={500}
                  value={editArtistBio}
                  onChange={(e) => setEditArtistBio(e.target.value)}
                  style={{ ...controlStyle, minHeight: 72, resize: 'vertical' }}
                />
              </div>
              <ImagePicker
                label={t('dashboard.imageLabel')}
                currentUrl={imagePublicUrl(supabase, a.image_path)}
                onChange={pickImage(setEditArtistImage)}
                disabled={savingArtist}
                hint={t('dashboard.imagePicker.hint', { max: MAX_IMAGE_MB })}
              />
              <Msg msg={artistError} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" type="button" disabled={savingArtist} onClick={() => saveArtist(a)}>
                  {savingArtist ? t('common.saving') : t('common.save')}
                </button>
                <button className="btn ghost" type="button" onClick={() => setEditingArtistId(null)}>
                  {t('common.cancel')}
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
                  <div className="notice">
                    {t('dashboard.artists.releaseCount', {
                      count: releases.filter((r) => r.artist_id === a.id).length,
                    })}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" type="button" onClick={() => startEditArtist(a)}>
                  {t('common.edit')}
                </button>
                <button className="btn ghost" type="button" onClick={() => deleteArtist(a)}>
                  {t('common.delete')}
                </button>
              </div>
            </div>
          )
        )}

        <form onSubmit={createArtist} style={{ marginTop: 20 }}>
          <h4 style={{ fontSize: 15, marginBottom: 12 }}>{t('dashboard.artists.createTitle')}</h4>
          <div className="field">
            <label>{t('signup.name')}</label>
            <input
              maxLength={80}
              value={newArtistName}
              onChange={(e) => setNewArtistName(e.target.value)}
              disabled={artistLimitReached}
            />
          </div>
          <div className="field">
            <label>{t('dashboard.artists.bioOptional')}</label>
            <textarea
              maxLength={500}
              value={newArtistBio}
              onChange={(e) => setNewArtistBio(e.target.value)}
              disabled={artistLimitReached}
              style={{ ...controlStyle, minHeight: 72, resize: 'vertical' }}
            />
          </div>
          <ImagePicker
            label={t('dashboard.imageLabel')}
            currentUrl={null}
            onChange={pickImage(setNewArtistImage)}
            disabled={artistLimitReached}
            hint={t('dashboard.imagePicker.hint', { max: MAX_IMAGE_MB })}
          />
          {artistLimitReached && (
            <div className="error-msg">{t('dashboard.artists.limitReached', { max: MAX_ARTISTS })}</div>
          )}
          <Msg msg={artistError} />
          <button className="btn" type="submit" disabled={creatingArtist || artistLimitReached}>
            {creatingArtist ? t('common.saving') : t('dashboard.artists.createButton')}
          </button>
        </form>
      </div>

      {/* ----- Mine udgivelser ----- */}
      <div className="panel" style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>
          {t('dashboard.releases.title', { count: releases.length })}
        </h3>
        <p className="notice" style={{ marginBottom: 16 }}>
          {t('dashboard.releases.limitsHint', {
            album: RELEASE_TYPE_LIMITS.album,
            ep: RELEASE_TYPE_LIMITS.ep,
            single: RELEASE_TYPE_LIMITS.single,
          })}
        </p>

        {releases.length === 0 && (
          <p className="notice" style={{ marginBottom: 16 }}>{t('dashboard.releases.empty')}</p>
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
                      {r.artists?.name || t('home.unknownArtist')} · {t(`type.${r.type}`)}
                      {r.genre ? ` · ${r.genre}` : ''} ·{' '}
                      {t('dashboard.releases.progress', { count: releaseTracks.length, limit })}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => (isEditing ? closeEditRelease() : startEditRelease(r))}
                  >
                    {isEditing ? t('common.close') : t('common.edit')}
                  </button>
                  <button className="btn ghost" type="button" onClick={() => deleteRelease(r)}>
                    {t('common.delete')}
                  </button>
                </div>
              </div>

              {isEditing && (
                <div style={{ marginTop: 12, paddingLeft: 4 }}>
                  <div className="field">
                    <label>{t('common.title')}</label>
                    <input maxLength={120} value={editReleaseTitle} onChange={(e) => setEditReleaseTitle(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>{t('common.type')}</label>
                    <select
                      style={controlStyle}
                      value={editReleaseType}
                      onChange={(e) => setEditReleaseType(e.target.value)}
                    >
                      {RELEASE_TYPES.map((value) => (
                        <option key={value} value={value}>{t(`type.${value}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>{t('dashboard.releases.genreLabel')}</label>
                    <input
                      value={editReleaseGenre}
                      onChange={(e) => setEditReleaseGenre(e.target.value)}
                      placeholder={t('dashboard.releases.genrePlaceholder')}
                    />
                  </div>
                  <ImagePicker
                    label={t('dashboard.coverArtLabel')}
                    currentUrl={imagePublicUrl(supabase, r.cover_path)}
                    onChange={pickImage(setEditReleaseImage)}
                    disabled={savingRelease}
                    hint={t('dashboard.imagePicker.hint', { max: MAX_IMAGE_MB })}
                  />
                  <Msg msg={releaseError} />
                  <button className="btn" type="button" disabled={savingRelease} onClick={() => saveRelease(r)}>
                    {savingRelease ? t('common.saving') : t('common.save')}
                  </button>

                  <h4 style={{ fontSize: 14, margin: '24px 0 12px' }}>{t('dashboard.releases.tracksHeading')}</h4>
                  {releaseTracks.length === 0 && (
                    <p className="notice" style={{ marginBottom: 12 }}>{t('dashboard.releases.noTracksYet')}</p>
                  )}
                  {releaseTracks.map((tr) => (
                    <div key={tr.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 10, flexWrap: 'wrap' }}>
                      <div className="field" style={{ margin: 0, flex: '1 1 220px' }}>
                        <label>{t('common.title')}</label>
                        <input value={trackValue(tr, 'title')} onChange={(e) => setTrackField(tr, 'title', e.target.value)} />
                      </div>
                      <button
                        className="btn ghost"
                        type="button"
                        disabled={!trackDirty(tr) || savingTrackId === tr.id}
                        onClick={() => saveTrack(tr)}
                      >
                        {savingTrackId === tr.id ? t('common.saving') : t('common.save')}
                      </button>
                      <button className="btn ghost" type="button" onClick={() => deleteTrack(tr)}>
                        {t('common.delete')}
                      </button>
                    </div>
                  ))}

                  <form onSubmit={(e) => handleUploadTrack(e, r)} style={{ marginTop: 16 }}>
                    <h4 style={{ fontSize: 14, marginBottom: 12 }}>{t('dashboard.releases.addTrack')}</h4>
                    <div className="field">
                      <label>{t('common.title')}</label>
                      <input disabled={atLimit} value={newTrackTitle} onChange={(e) => setNewTrackTitle(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>{t('dashboard.releases.audioFileLabel')}</label>
                      <input
                        type="file"
                        accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff,audio/*"
                        disabled={atLimit}
                        onChange={handleNewTrackFile}
                      />
                      <div className="notice" style={{ marginTop: 6 }}>
                        {t('dashboard.releases.uploadHint', { max: MAX_UPLOAD_MB })}
                      </div>
                    </div>
                    {atLimit && (
                      <div className="error-msg">
                        {t('dashboard.releases.atLimit', { type: t(`type.${r.type}`), limit })}
                      </div>
                    )}
                    <Msg msg={trackUploadError} />
                    <button className="btn" type="submit" disabled={atLimit || uploadingTrack}>
                      {uploadingTrack ? t('dashboard.releases.uploading') : t('dashboard.releases.addTrack')}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )
        })}

        {artists.length === 0 ? (
          <p className="notice" style={{ marginTop: 8 }}>{t('dashboard.releases.needArtistFirst')}</p>
        ) : (
          <form onSubmit={createRelease} style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 15, marginBottom: 12 }}>{t('dashboard.releases.createHeading')}</h4>
            <div className="field">
              <label>{t('dashboard.releases.artistLabel')}</label>
              <select style={controlStyle} value={newReleaseArtistId} onChange={(e) => setNewReleaseArtistId(e.target.value)}>
                {artists.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('common.title')}</label>
              <input maxLength={120} value={newReleaseTitle} onChange={(e) => setNewReleaseTitle(e.target.value)} />
            </div>
            <div className="field">
              <label>{t('common.type')}</label>
              <select style={controlStyle} value={newReleaseType} onChange={(e) => setNewReleaseType(e.target.value)}>
                {RELEASE_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {t('dashboard.releases.typeOption', { label: t(`type.${value}`), limit: RELEASE_TYPE_LIMITS[value] })}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('dashboard.releases.genreLabel')}</label>
              <input
                value={newReleaseGenre}
                onChange={(e) => setNewReleaseGenre(e.target.value)}
                placeholder={t('dashboard.releases.genrePlaceholder')}
              />
            </div>
            <ImagePicker
              label={t('dashboard.coverArtLabel')}
              currentUrl={null}
              onChange={pickImage(setNewReleaseImage)}
              hint={t('dashboard.imagePicker.hint', { max: MAX_IMAGE_MB })}
            />
            <Msg msg={releaseError} />
            <button className="btn" type="submit" disabled={creatingRelease}>
              {creatingRelease ? t('common.saving') : t('dashboard.releases.createButton')}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
