'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import QueuePlayer from '../../components/QueuePlayer'

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
      setError('Ingen genre angivet.')
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
        .filter((t) => urlByPath[t.audio_path])
        .map((t) => ({
          id: t.id,
          title: t.title,
          artistName: t.releases?.artists?.name || 'Ukendt kunstner',
          releaseTitle: t.releases?.title,
          url: urlByPath[t.audio_path],
        }))
    )
  }

  async function handleTrackStart(t) {
    try {
      await supabase.rpc('increment_play_count', { track_id: t.id })
    } catch {
      // Tæller-opdateringen fejlede stille — påvirker ikke afspilningen
    }
  }

  if (session === undefined || tracks === null) return <p className="notice">Henter...</p>

  return (
    <section>
      <h2>Radio — {genre}</h2>
      <p className="notice" style={{ marginTop: 8, marginBottom: 20 }}>
        Spiller tilfældige numre inden for genren, i det uendelige.
      </p>
      {error && <p className="error-msg">{error}</p>}
      <QueuePlayer
        tracks={tracks}
        autoStart
        loop
        onTrackStart={handleTrackStart}
        emptyMessage="Ingen numre fundet i denne genre."
      />
    </section>
  )
}

export default function RadioPage() {
  return (
    <Suspense fallback={<p className="notice">Henter...</p>}>
      <RadioContent />
    </Suspense>
  )
}
