'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { RELEASE_TYPE_LABELS, imagePublicUrl } from '../../../lib/shared'

// Hvor længe et afspilningslink er gyldigt (6 timer)
const SIGNED_URL_SECONDS = 60 * 60 * 6

export default function ReleasePage() {
  const { id } = useParams()
  const [release, setRelease] = useState(null)
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadRelease()
  }, [id])

  async function loadRelease() {
    const { data: releaseData } = await supabase
      .from('releases')
      .select('id, title, type, color, cover_path, artist_id, publisher_id, artists ( name ), profiles ( display_name )')
      .eq('id', id)
      .single()
    setRelease(releaseData)

    if (!releaseData) {
      setLoading(false)
      return
    }

    const { data: trackData } = await supabase
      .from('tracks')
      .select('*')
      .eq('release_id', id)
      .order('created_at', { ascending: true })
    const trackList = trackData || []

    // Bucketten er privat, så vi henter midlertidige links til lydfilerne.
    // Anonyme besøgende har ikke adgang, og linkene bliver blot tomme for dem.
    const urlByPath = {}
    if (trackList.length > 0) {
      const { data: signed } = await supabase.storage
        .from('tracks')
        .createSignedUrls(trackList.map((t) => t.audio_path), SIGNED_URL_SECONDS)
      for (const s of signed || []) {
        if (s.signedUrl) urlByPath[s.path] = s.signedUrl
      }
    }

    setTracks(trackList.map((t) => ({ ...t, url: urlByPath[t.audio_path] || null })))
    setLoading(false)
  }

  if (loading) return <p className="notice">Henter...</p>
  if (!release) return <p className="notice">Udgivelse ikke fundet.</p>

  const coverUrl = imagePublicUrl(supabase, release.cover_path)
  const publisherName = release.profiles?.display_name
  const artistName = release.artists?.name
  const showPublisher = publisherName && publisherName.trim().toLowerCase() !== (artistName || '').trim().toLowerCase()

  return (
    <section>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div
          className="cover"
          style={{
            width: 200,
            height: 200,
            flexShrink: 0,
            background: coverUrl ? undefined : release.color || '#B8452B',
            backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {!coverUrl && <span className="title">{release.title}</span>}
        </div>
        <div>
          <div className="notice">{RELEASE_TYPE_LABELS[release.type] || release.type}</div>
          <h2 style={{ marginTop: 4 }}>{release.title}</h2>
          <p className="notice" style={{ marginTop: 4 }}>
            <Link href={`/artist/${release.artist_id}`}>{artistName || 'Ukendt kunstner'}</Link>
            {showPublisher && <> · Udgivet af {publisherName}</>}
          </p>
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        {tracks.length === 0 && <p className="notice">Ingen numre i denne udgivelse endnu.</p>}
        {tracks.map((t) => (
          <div className="track-row" key={t.id}>
            <div className="ttitle">
              {t.title}
              <div className="notice">{t.genre}</div>
            </div>
            {t.url ? (
              <audio controls preload="none" src={t.url} />
            ) : (
              <span className="notice">Log ind for at lytte.</span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
