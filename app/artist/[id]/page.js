'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { RELEASE_TYPE_LABELS } from '../../../lib/shared'

// Hvor længe et afspilningslink er gyldigt (6 timer)
const SIGNED_URL_SECONDS = 60 * 60 * 6

export default function ArtistPage() {
  const { id } = useParams()
  const [artist, setArtist] = useState(null)
  const [releases, setReleases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadArtist()
  }, [id])

  async function loadArtist() {
    const { data: artistData } = await supabase
      .from('artists')
      .select('id, name, bio, publisher_id, profiles ( display_name )')
      .eq('id', id)
      .single()
    setArtist(artistData)

    if (!artistData) {
      setLoading(false)
      return
    }

    const { data: releaseData } = await supabase
      .from('releases')
      .select('*')
      .eq('artist_id', id)
      .order('created_at', { ascending: false })
    const releaseList = releaseData || []

    const { data: trackData } = await supabase
      .from('tracks')
      .select('*')
      .eq('artist_id', id)
      .order('created_at', { ascending: true })
    const trackList = trackData || []

    // Bucketten er privat, så vi henter midlertidige links til lydfilerne.
    // Anonyme besøgende har ikke adgang til storage, så linkene bliver blot tomme for dem.
    const urlByPath = {}
    if (trackList.length > 0) {
      const { data: signed } = await supabase.storage
        .from('tracks')
        .createSignedUrls(trackList.map((t) => t.audio_path), SIGNED_URL_SECONDS)
      for (const s of signed || []) {
        if (s.signedUrl) urlByPath[s.path] = s.signedUrl
      }
    }

    setReleases(
      releaseList.map((r) => ({
        ...r,
        tracks: trackList
          .filter((t) => t.release_id === r.id)
          .map((t) => ({ ...t, url: urlByPath[t.audio_path] || null })),
      }))
    )
    setLoading(false)
  }

  if (loading) return <p className="notice">Henter...</p>
  if (!artist) return <p className="notice">Kunstner ikke fundet.</p>

  const publisherName = artist.profiles?.display_name
  const showPublisher =
    publisherName && publisherName.trim().toLowerCase() !== artist.name.trim().toLowerCase()

  return (
    <section>
      <h2>{artist.name}</h2>
      {showPublisher && (
        <p className="notice" style={{ marginTop: 4 }}>Udgivet af {publisherName}</p>
      )}
      {artist.bio && <p className="notice" style={{ marginTop: 8 }}>{artist.bio}</p>}

      <div style={{ marginTop: 24 }}>
        {releases.length === 0 && <p className="notice">Ingen udgivelser endnu.</p>}
        {releases.map((r) => (
          <div key={r.id} style={{ marginBottom: 28 }}>
            <div className="section-head">
              <h3 style={{ fontSize: 16 }}>{r.title}</h3>
              <span className="notice">{RELEASE_TYPE_LABELS[r.type] || r.type}</span>
            </div>
            {r.tracks.length === 0 && <p className="notice">Ingen numre i denne udgivelse endnu.</p>}
            {r.tracks.map((t) => (
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
        ))}
      </div>
    </section>
  )
}
