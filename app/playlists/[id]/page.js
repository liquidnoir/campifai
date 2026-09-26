'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import QueuePlayer from '../../../components/QueuePlayer'
import { useLanguage } from '../../../components/LanguageProvider'

// Hvor længe et afspilningslink er gyldigt (6 timer)
const SIGNED_URL_SECONDS = 60 * 60 * 6

export default function PlaylistPage() {
  const { t } = useLanguage()
  const { id } = useParams()
  const router = useRouter()
  const [session, setSession] = useState(undefined)
  const [playlist, setPlaylist] = useState(null)
  const [rows, setRows] = useState([]) // { id (playlist_tracks.id), track }
  const [loading, setLoading] = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (session === null) {
      router.replace('/login')
      return
    }
    if (id) load()
  }, [session, id])

  async function load() {
    setLoading(true)
    const { data: playlistData } = await supabase.from('playlists').select('*').eq('id', id).single()
    setPlaylist(playlistData)
    if (playlistData) setTitleValue(playlistData.title)

    if (!playlistData) {
      setLoading(false)
      return
    }

    const { data: ptData } = await supabase
      .from('playlist_tracks')
      .select('id, added_at, tracks ( id, title, audio_path, release_id, releases ( title, artist_id, artists ( name ) ) )')
      .eq('playlist_id', id)
      .order('added_at', { ascending: true })
    const list = (ptData || []).filter((row) => row.tracks)

    const urlByPath = {}
    if (list.length > 0) {
      const { data: signed } = await supabase.storage
        .from('tracks')
        .createSignedUrls(list.map((row) => row.tracks.audio_path), SIGNED_URL_SECONDS)
      for (const s of signed || []) {
        if (s.signedUrl) urlByPath[s.path] = s.signedUrl
      }
    }

    setRows(
      list.map((row) => ({
        id: row.id,
        track: { ...row.tracks, url: urlByPath[row.tracks.audio_path] || null },
      }))
    )
    setLoading(false)
  }

  async function removeRow(row) {
    await supabase.from('playlist_tracks').delete().eq('id', row.id)
    load()
  }

  async function saveTitle() {
    const title = titleValue.trim()
    if (!title) return
    await supabase.from('playlists').update({ title }).eq('id', id)
    setEditingTitle(false)
    load()
  }

  async function deletePlaylist() {
    if (!window.confirm(t('playlists.deleteConfirm', { title: playlist.title }))) return
    await supabase.from('playlists').delete().eq('id', id)
    router.push('/playlists')
  }

  async function handleTrackStart(tr) {
    try {
      await supabase.rpc('increment_play_count', { track_id: tr.id })
    } catch {
      // Tæller-opdateringen fejlede stille — påvirker ikke afspilningen
    }
  }

  if (session === undefined || loading) return <p className="notice">{t('common.loading')}</p>
  if (!playlist) return <p className="notice">{t('playlists.notFound')}</p>

  const playerTracks = rows
    .filter((r) => r.track.url)
    .map((r) => ({
      id: r.track.id,
      title: r.track.title,
      artistName: r.track.releases?.artists?.name || t('home.unknownArtist'),
      releaseTitle: r.track.releases?.title,
      url: r.track.url,
    }))

  return (
    <section>
      {editingTitle ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 420 }}>
          <input value={titleValue} onChange={(e) => setTitleValue(e.target.value)} maxLength={100} style={{ flex: 1 }} />
          <button className="btn" type="button" onClick={saveTitle}>{t('common.save')}</button>
          <button className="btn ghost" type="button" onClick={() => { setEditingTitle(false); setTitleValue(playlist.title) }}>
            {t('common.cancel')}
          </button>
        </div>
      ) : (
        <div className="section-head">
          <h2>{playlist.title}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" type="button" onClick={() => setEditingTitle(true)}>{t('playlists.rename')}</button>
            <button className="btn ghost" type="button" onClick={deletePlaylist}>{t('playlists.deleteButton')}</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <QueuePlayer
          tracks={playerTracks}
          onTrackStart={handleTrackStart}
          emptyMessage={t('playlists.noPlayableTracks')}
        />
      </div>

      {rows.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>{t('playlists.manageTracks')}</h3>
          {rows.map((row) => (
            <div className="track-row" key={row.id}>
              <div className="ttitle">
                {row.track.title}
                <div className="notice">
                  {row.track.releases?.artists?.name || t('home.unknownArtist')} · {row.track.releases?.title}
                </div>
              </div>
              <button className="btn ghost" type="button" onClick={() => removeRow(row)}>
                {t('adminCollectionDetail.remove')}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
