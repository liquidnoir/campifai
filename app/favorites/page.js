'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { imagePublicUrl } from '../../lib/shared'
import { queueSignature, shuffle } from '../../lib/playerQueue'
import { useDurations } from '../../lib/useDurations'
import { useLanguage } from '../../components/LanguageProvider'
import TrackList from '../../components/TrackList'
import { usePlayer } from '../../components/PlayerProvider'
import TrackMenu from '../../components/TrackMenu'
import EmptyState from '../../components/EmptyState'
import { ListSkeleton } from '../../components/Skeletons'

// Hvor længe et afspilningslink er gyldigt (6 timer)
const SIGNED_URL_SECONDS = 60 * 60 * 6

// Brugerens favoritter, nyeste først. Et nummer, man fjerner hjertet fra, bliver stående, til siden
// åbnes igen — så et uheldigt tryk kan fortrydes med endnu et tryk.
export default function FavoritesPage() {
  const { t } = useLanguage()
  const player = usePlayer()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const durations = useDurations(rows.filter((r) => r.url).map((r) => ({ id: r.id, url: r.url })))

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data, error: loadError } = await supabase
      .from('favorites')
      .select('created_at, tracks ( id, title, audio_path, release_id, artists ( name ), releases ( title, artist_id, cover_path, artists ( name ) ) )')
      .order('created_at', { ascending: false })
    if (loadError) {
      setError(true)
      setLoading(false)
      return
    }
    const list = (data || []).filter((row) => row.tracks).map((row) => row.tracks)

    const urlByPath = {}
    if (list.length > 0) {
      const { data: signed } = await supabase.storage
        .from('tracks')
        .createSignedUrls(list.map((track) => track.audio_path), SIGNED_URL_SECONDS)
      for (const s of signed || []) {
        if (s.signedUrl) urlByPath[s.path] = s.signedUrl
      }
    }
    setRows(list.map((track) => ({ ...track, url: urlByPath[track.audio_path] || null })))
    setLoading(false)
  }

  const playerTracks = useMemo(
    () =>
      rows
        .filter((track) => track.url)
        .map((track) => {
          const artist = track.artists?.name || track.releases?.artists?.name || t('home.unknownArtist')
          return {
            id: track.id,
            title: track.title,
            artistName: artist,
            mediaArtist: artist,
            releaseTitle: track.releases?.title,
            releaseId: track.release_id,
            audioPath: track.audio_path,
            coverUrl: imagePublicUrl(supabase, track.releases?.cover_path),
            url: track.url,
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows]
  )

  if (loading) return <ListSkeleton />

  const sourceKey = `favorites:${queueSignature(playerTracks)}`
  const active = player.sourceKey === sourceKey && player.queue.length > 0
  const playing = active && player.playing

  // Afspil i rækkefølge (nyeste først), eller bland: en blandet kø, der blander forfra, når den er slut
  function playAll() {
    if (active) player.togglePlay()
    else player.playQueue(playerTracks, 0, { sourceKey })
  }
  function playShuffled() {
    player.playQueue(shuffle(playerTracks), 0, { sourceKey, loop: true })
  }

  return (
    <section>
      <div className="section-head">
        <h2>{t('favorites.title')}</h2>
        {rows.length > 0 && <span className="notice">{t('release.trackCount', { count: rows.length })}</span>}
      </div>

      {error && <p className="error-msg">{t('favorites.loadError')}</p>}
      {!error && rows.length === 0 && (
        <EmptyState text={t('favorites.empty')} hint={t('favorites.emptyHint')} href="/" action={t('playlists.emptyAction')} />
      )}
      {playerTracks.length > 0 && (
        <div className="fav-actions">
          <button className="btn release-play" type="button" onClick={playAll}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              {playing ? (
                <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
              ) : (
                <path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5z" />
              )}
            </svg>
            {playing ? t('release.pause') : t('common.play')}
          </button>
          <button className="btn ghost release-play" type="button" onClick={playShuffled}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 3h5v5" />
              <path d="M4 20L21 3" />
              <path d="M21 16v5h-5" />
              <path d="M15 15l6 6" />
              <path d="M4 4l5 5" />
            </svg>
            {t('favorites.shuffle')}
          </button>
        </div>
      )}
      {rows.length > 0 && (
        <TrackList
          sourceKey={sourceKey}
          showPlayAll={false}
          tracks={playerTracks}
          emptyMessage={t('favorites.noPlayable')}
          durations={durations}
          renderActions={(track) => <TrackMenu track={track} />}
        />
      )}
    </section>
  )
}
