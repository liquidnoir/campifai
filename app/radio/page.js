'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { imagePublicUrl } from '../../lib/shared'
import TrackList from '../../components/TrackList'
import QueueMenu from '../../components/QueueMenu'
import { usePlayer } from '../../components/PlayerProvider'
import { buildRadioPools, takeNextBatch } from '../../lib/radioPool'
import { useLanguage } from '../../components/LanguageProvider'

// Hvor længe et afspilningslink er gyldigt (6 timer)
const SIGNED_URL_SECONDS = 60 * 60 * 6
// Antal numre, der lægges i kanalen ad gangen (hver portion får sine egne afspilningslinks)
const BATCH_SIZE = 40
// Maks. antal numre, der overvejes i alt (radioen vælger blandt dem)
const CATALOG_LIMIT = 1000

function RadioContent() {
  const { t } = useLanguage()
  const router = useRouter()
  const player = usePlayer()
  const searchParams = useSearchParams()
  const genre = searchParams.get('genre') || ''
  const fromTrackId = searchParams.get('from') || ''
  // Spiller netop denne radio allerede (man kom tilbage til siden), lades den være i fred
  const sourceKey = `radio:${genre}:${fromTrackId}`
  const alreadyPlaying = player.sourceKey === sourceKey && player.queue.length > 0
  const [session, setSession] = useState(undefined)
  const [tracks, setTracks] = useState(null) // null = ikke hentet endnu
  const [error, setError] = useState('')
  // Er genrens uafspillede numre brugt op, så radioen er gået over til andre genrer?
  const [switched, setSwitched] = useState(false)
  // Numre, der endnu ikke er lagt i køen: genrens egne, og alle andre
  const poolsRef = useRef({ genre: [], other: [] })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (session === null) {
      router.replace('/login')
      return
    }
    if (!genre) {
      setError(t('radio.noGenre'))
      setTracks([])
      return
    }
    if (alreadyPlaying) {
      setTracks(player.queue)
      return
    }
    loadChannel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, genre])

  // Henter afspilningslinks til en række numre og gør dem klar til afspilleren
  async function prepareTracks(rows) {
    const urlByPath = {}
    const { data: signed } = await supabase.storage
      .from('tracks')
      .createSignedUrls(rows.map((row) => row.audio_path), SIGNED_URL_SECONDS)
    for (const item of signed || []) {
      if (item.signedUrl) urlByPath[item.path] = item.signedUrl
    }
    return rows
      .filter((tr) => urlByPath[tr.audio_path])
      .map((tr) => ({
        id: tr.id,
        title: tr.title,
        artistName: tr.artists?.name || tr.releases?.artists?.name || t('home.unknownArtist'),
        releaseTitle: tr.releases?.title,
        releaseId: tr.release_id,
        audioPath: tr.audio_path,
        coverUrl: imagePublicUrl(supabase, tr.releases?.cover_path),
        url: urlByPath[tr.audio_path],
      }))
  }

  // Næste portion til køen: genrens uafspillede numre først, derefter tilfældige numre fra
  // andre genrer. Returnerer [] først, når ALT er lagt i køen.
  async function takeBatch() {
    for (;;) {
      const { rows, fromOtherGenres } = takeNextBatch(poolsRef.current, BATCH_SIZE)
      if (rows.length === 0) return []
      if (fromOtherGenres) setSwitched(true)
      const ready = await prepareTracks(rows)
      if (ready.length > 0) return ready
      // Ingen i denne portion kunne afspilles (fx manglende filer) — prøv næste portion
    }
  }

  async function loadChannel() {
    const { data, error: fetchError } = await supabase
      .from('tracks')
      .select('id, title, audio_path, release_id, artists ( name ), releases!inner ( title, genre, artist_id, cover_path, artists ( name ) )')
      .limit(CATALOG_LIMIT)
    if (fetchError) {
      setError(fetchError.message)
      setTracks([])
      return
    }
    poolsRef.current = buildRadioPools(data || [], genre, fromTrackId)
    setSwitched(false)
    setTracks(await takeBatch())
  }

  if (session === undefined || tracks === null) return <p className="notice">{t('common.loading')}</p>

  return (
    <section>
      <h2>{t('radio.titleWithGenre', { genre })}</h2>
      <p className="notice" style={{ marginTop: 8, marginBottom: 20 }}>{t('radio.subtitle')}</p>
      {error && <p className="error-msg">{error}</p>}
      {switched && (
        <p className="notice" style={{ marginBottom: 12 }}>{t('radio.switchedToOthers', { genre })}</p>
      )}
      <TrackList
        sourceKey={sourceKey}
        tracks={tracks}
        autoStart
        loop
        onNeedMore={takeBatch}
        emptyMessage={t('radio.noTracksInGenre')}
        renderActions={(track) => <QueueMenu track={track} />}
      />
    </section>
  )
}

export default function RadioPage() {
  const { t } = useLanguage()
  return (
    <Suspense fallback={<p className="notice">{t('common.loading')}</p>}>
      <RadioContent />
    </Suspense>
  )
}
