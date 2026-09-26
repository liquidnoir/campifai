'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import QueuePlayer from '../../components/QueuePlayer'
import { useLanguage } from '../../components/LanguageProvider'

// Hvor længe et afspilningslink er gyldigt (6 timer)
const SIGNED_URL_SECONDS = 60 * 60 * 6
// Maks. antal numre, der hentes ind i kanalen ad gangen
const MAX_CHANNEL_TRACKS = 40

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function RadioContent() {
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const genre = searchParams.get('genre') || ''
  const fromTrackId = searchParams.get('from') || ''
  const [session, setSession] = useState(undefined)
  const [tracks, setTracks] = useState(null) // null = ikke hentet endnu
  const [error, setError] = useState('')

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
    loadChannel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, genre])

  async function loadChannel() {
    const { data, error: fetchError } = await supabase
      .from('tracks')
      .select('id, title, audio_path, release_id, releases!inner ( title, genre, artist_id, artists ( name ) )')
      .eq('releases.genre', genre)
      .limit(200)
    if (fetchError) {
      setError(fetchError.message)
      setTracks([])
      return
    }
    let list = data || []
    let ordered = shuffle(list)
    if (fromTrackId) {
      const idx = ordered.findIndex((t) => t.id === fromTrackId)
      if (idx > 0) {
        const [first] = ordered.splice(idx, 1)
        ordered = [first, ...ordered]
      }
    }
    ordered = ordered.slice(0, MAX_CHANNEL_TRACKS)

    const urlByPath = {}
    if (ordered.length > 0) {
      const { data: signed } = await supabase.storage
        .from('tracks')
        .createSignedUrls(ordered.map((t) => t.audio_path), SIGNED_URL_SECONDS)
      for (const s of signed || []) {
        if (s.signedUrl) urlByPath[s.path] = s.signedUrl
      }
    }

    setTracks(
      ordered
        .filter((tr) => urlByPath[tr.audio_path])
        .map((tr) => ({
          id: tr.id,
          title: tr.title,
          artistName: tr.releases?.artists?.name || t('home.unknownArtist'),
          releaseTitle: tr.releases?.title,
          url: urlByPath[tr.audio_path],
        }))
    )
  }

  async function handleTrackStart(tr) {
    try {
      await supabase.rpc('increment_play_count', { track_id: tr.id })
    } catch {
      // Tæller-opdateringen fejlede stille — påvirker ikke afspilningen
    }
  }

  if (session === undefined || tracks === null) return <p className="notice">{t('common.loading')}</p>

  return (
    <section>
      <h2>{t('radio.titleWithGenre', { genre })}</h2>
      <p className="notice" style={{ marginTop: 8, marginBottom: 20 }}>{t('radio.subtitle')}</p>
      {error && <p className="error-msg">{error}</p>}
      <QueuePlayer
        tracks={tracks}
        autoStart
        loop
        onTrackStart={handleTrackStart}
        emptyMessage={t('radio.noTracksInGenre')}
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
