'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import {
  MAX_IMAGE_MB,
  RELEASE_TYPE_LIMITS,
  controlStyle,
  imagePublicUrl,
  removeImage,
  uploadImage,
} from '../../../../lib/shared'
import { useLanguage } from '../../../../components/LanguageProvider'

function Msg({ msg }) {
  if (!msg) return null
  if (msg.type === 'error') return <div className="error-msg">{msg.text}</div>
  return <div style={{ color: '#4B5A3E', fontSize: 14, marginBottom: 12 }}>{msg.text}</div>
}

const RELEASE_TYPES = Object.keys(RELEASE_TYPE_LIMITS)

export default function AdminReleaseEditPage() {
  const { t } = useLanguage()
  const { id } = useParams()
  const router = useRouter()
  const [session, setSession] = useState(undefined)
  const [me, setMe] = useState(null)
  const [checked, setChecked] = useState(false)
  const [release, setRelease] = useState(null)
  const [tracks, setTracks] = useState([])
  const [artists, setArtists] = useState([])
  const [notFound, setNotFound] = useState(false)

  // Udgivelsens egne felter
  const [title, setTitle] = useState('')
  const [type, setType] = useState('single')
  const [genre, setGenre] = useState('')
  const [artistId, setArtistId] = useState('')
  const [coverFile, setCoverFile] = useState(null)
  const [savingRelease, setSavingRelease] = useState(false)
  const [releaseMsg, setReleaseMsg] = useState(null)

  // Numre
  const [trackEdits, setTrackEdits] = useState({}) // { [trackId]: { title?, artist_id? } }
  const [savingTrackId, setSavingTrackId] = useState('')
  const [reorderBusy, setReorderBusy] = useState(false)
  const [trackMsg, setTrackMsg] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (session === null) {
      router.replace('/login')
      return
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id])

  async function init() {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setMe(data || null)
    if (data?.role === 'admin') await load()
    setChecked(true)
  }

  async function load() {
    const [releaseRes, tracksRes, artistsRes] = await Promise.all([
      supabase
        .from('releases')
        .select('*, artists ( name ), profiles ( display_name )')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('tracks')
        .select('*, artists ( name )')
        .eq('release_id', id)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('artists').select('id, name, publisher_id, profiles ( display_name )').order('name', { ascending: true }),
    ])
    if (!releaseRes.data) {
      setNotFound(true)
      return
    }
    const r = releaseRes.data
    setRelease(r)
    setTitle(r.title)
    setType(r.type)
    setGenre(r.genre || '')
    setArtistId(r.artist_id)
    setTracks(tracksRes.data || [])
    setArtists(artistsRes.data || [])
    setTrackEdits({})
  }

  // "Navn (publisher)" — publisher udelades, når den hedder det samme som kunstneren
  function artistLabel(a) {
    const publisher = a.profiles?.display_name
    if (!publisher || publisher.trim().toLowerCase() === a.name.trim().toLowerCase()) return a.name
    return `${a.name} (${publisher})`
  }

  async function saveRelease(e) {
    e.preventDefault()
    setReleaseMsg(null)
    const titleValue = title.trim()
    if (!titleValue) {
      setReleaseMsg({ type: 'error', text: t('dashboard.releases.titleEmpty') })
      return
    }
    setSavingRelease(true)
    try {
      const changes = { title: titleValue, type, genre: genre.trim() || null }
      if (artistId && artistId !== release.artist_id) changes.artist_id = artistId
      if (coverFile) {
        changes.cover_path = await uploadImage(supabase, session.user.id, 'release', coverFile, t)
      }
      const { error } = await supabase.from('releases').update(changes).eq('id', id)
      if (error) throw error
      if (coverFile && release.cover_path) await removeImage(supabase, release.cover_path)
      setCoverFile(null)
      await load()
      setReleaseMsg({ type: 'ok', text: t('adminRelease.saved') })
    } catch (err) {
      setReleaseMsg({ type: 'error', text: err.message || t('common.somethingWrong') })
    }
    setSavingRelease(false)
  }

  // ----- Numre -----
  function trackValue(tr, field) {
    return trackEdits[tr.id]?.[field] ?? tr[field] ?? ''
  }
  function setTrackField(tr, field, value) {
    setTrackEdits((prev) => ({ ...prev, [tr.id]: { ...prev[tr.id], [field]: value } }))
  }
  function trackDirty(tr) {
    const edit = trackEdits[tr.id]
    if (!edit) return false
    const titleChanged = edit.title !== undefined && edit.title.trim() !== tr.title
    const artistChanged = edit.artist_id !== undefined && edit.artist_id !== tr.artist_id
    return titleChanged || artistChanged
  }

  async function saveTrack(tr) {
    setTrackMsg(null)
    const titleValue = trackValue(tr, 'title').trim()
    if (!titleValue) {
      setTrackMsg({ type: 'error', text: t('dashboard.releases.titleEmpty') })
      return
    }
    const changes = { title: titleValue }
    const chosenArtist = trackValue(tr, 'artist_id')
    if (chosenArtist && chosenArtist !== tr.artist_id) changes.artist_id = chosenArtist
    setSavingTrackId(tr.id)
    const { error } = await supabase.from('tracks').update(changes).eq('id', tr.id)
    setSavingTrackId('')
    if (error) {
      setTrackMsg({ type: 'error', text: error.message })
      return
    }
    await load()
    setTrackMsg({ type: 'ok', text: t('adminRelease.trackSaved') })
  }

  async function moveTrack(index, delta) {
    const target = index + delta
    if (target < 0 || target >= tracks.length) return
    const ids = tracks.map((tr) => tr.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    setTrackMsg(null)
    setReorderBusy(true)
    const { error } = await supabase.rpc('set_release_track_order', { p_release_id: id, p_track_ids: ids })
    setReorderBusy(false)
    if (error) {
      setTrackMsg({ type: 'error', text: error.message })
      return
    }
    await load()
  }

  if (session === undefined || !checked) return <p className="notice">{t('common.loading')}</p>
  if (me?.role !== 'admin') {
    return (
      <section>
        <h2>{t('adminRelease.title')}</h2>
        <p className="notice" style={{ marginTop: 12 }}>{t('admin.noAccess')}</p>
      </section>
    )
  }
  if (notFound) {
    return (
      <section>
        <p style={{ marginBottom: 8 }}>
          <Link href="/admin/releases">← {t('adminRelease.back')}</Link>
        </p>
        <p className="notice">{t('release.notFound')}</p>
      </section>
    )
  }
  if (!release) return <p className="notice">{t('common.loading')}</p>

  const coverUrl = imagePublicUrl(supabase, release.cover_path)

  return (
    <section>
      <p style={{ marginBottom: 8 }}>
        <Link href="/admin/releases">← {t('adminRelease.back')}</Link>
      </p>
      <div className="section-head">
        <h2>{t('adminRelease.title')}</h2>
        <Link href={`/release/${release.id}`} className="btn ghost">
          {t('adminRelease.viewRelease')}
        </Link>
      </div>
      <p className="notice" style={{ marginBottom: 20 }}>
        {t('artist.publishedBy', { name: release.profiles?.display_name || t('admin.unknown') })}
      </p>

      <form onSubmit={saveRelease} className="panel" style={{ maxWidth: 560, marginBottom: 28 }}>
        <div className="field">
          <label>{t('common.title')}</label>
          <input maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('common.type')}</label>
          <select style={controlStyle} value={type} onChange={(e) => setType(e.target.value)}>
            {RELEASE_TYPES.map((value) => (
              <option key={value} value={value}>{t(`type.${value}`)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t('dashboard.releases.genreLabel')}</label>
          <input
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder={t('dashboard.releases.genrePlaceholder')}
          />
        </div>
        <div className="field">
          <label>{t('adminRelease.artist')}</label>
          <select style={controlStyle} value={artistId} onChange={(e) => setArtistId(e.target.value)}>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>{artistLabel(a)}</option>
            ))}
          </select>
          <div className="notice" style={{ marginTop: 6 }}>{t('adminRelease.artistHint')}</div>
        </div>
        <div className="field">
          <label>{t('dashboard.coverArtLabel')}</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {coverUrl && (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  flexShrink: 0,
                  backgroundImage: `url(${coverUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            )}
            <input
              type="file"
              accept="image/*"
              disabled={savingRelease}
              onChange={(e) => setCoverFile(e.target.files[0] || null)}
            />
          </div>
          <div className="notice" style={{ marginTop: 4 }}>{t('dashboard.imagePicker.hint', { max: MAX_IMAGE_MB })}</div>
        </div>
        <Msg msg={releaseMsg} />
        <button className="btn" type="submit" disabled={savingRelease}>
          {savingRelease ? t('common.saving') : t('common.save')}
        </button>
      </form>

      <h3 style={{ fontSize: 16, marginBottom: 12 }}>{t('adminRelease.tracksHeading', { count: tracks.length })}</h3>
      <Msg msg={trackMsg} />
      {tracks.length === 0 && <p className="notice">{t('adminRelease.noTracks')}</p>}
      {tracks.map((tr, idx) => (
        <div
          key={tr.id}
          className="panel"
          style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 10 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              className="btn ghost"
              type="button"
              style={{ padding: '2px 10px' }}
              aria-label={t('tracks.moveUp')}
              disabled={reorderBusy || idx === 0}
              onClick={() => moveTrack(idx, -1)}
            >
              ↑
            </button>
            <button
              className="btn ghost"
              type="button"
              style={{ padding: '2px 10px' }}
              aria-label={t('tracks.moveDown')}
              disabled={reorderBusy || idx === tracks.length - 1}
              onClick={() => moveTrack(idx, 1)}
            >
              ↓
            </button>
          </div>
          <div className="field" style={{ margin: 0, flex: '1 1 200px' }}>
            <label>{idx + 1}. {t('common.title')}</label>
            <input value={trackValue(tr, 'title')} onChange={(e) => setTrackField(tr, 'title', e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0, flex: '1 1 200px' }}>
            <label>{t('dashboard.releases.trackArtist')}</label>
            <select
              style={controlStyle}
              value={trackValue(tr, 'artist_id')}
              onChange={(e) => setTrackField(tr, 'artist_id', e.target.value)}
            >
              {artists.map((a) => (
                <option key={a.id} value={a.id}>{artistLabel(a)}</option>
              ))}
            </select>
          </div>
          <button
            className="btn"
            type="button"
            disabled={!trackDirty(tr) || savingTrackId === tr.id}
            onClick={() => saveTrack(tr)}
          >
            {savingTrackId === tr.id ? t('common.saving') : t('common.save')}
          </button>
        </div>
      ))}
    </section>
  )
}
