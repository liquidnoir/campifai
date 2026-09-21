'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

// Hvor længe et afspilningslink er gyldigt (6 timer)
const SIGNED_URL_SECONDS = 60 * 60 * 6

export default function ArtistPage() {
  const { id } = useParams()
  const [artist, setArtist] = useState(null)
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadArtist()
  }, [id])

  async function loadArtist() {
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', id).single()
    setArtist(profileData)

    const { data: trackData } = await supabase
      .from('tracks')
      .select('*')
      .eq('artist_id', id)
      .order('created_at', { ascending: false })
    const list = trackData || []

    // Bucketten er privat, så vi henter midlertidige links til lydfilerne
    const urlByPath = {}
    if (list.length > 0) {
      const { data: signed } = await supabase.storage
        .from('tracks')
        .createSignedUrls(list.map((t) => t.audio_path), SIGNED_URL_SECONDS)
      for (const s of signed || []) {
        if (s.signedUrl) urlByPath[s.path] = s.signedUrl
      }
    }

    setTracks(list.map((t) => ({ ...t, url: urlByPath[t.audio_path] || null })))
    setLoading(false)
  }

  if (loading) return <p className="notice">Henter...</p>
  if (!artist) return <p className="notice">Kunstner ikke fundet.</p>

  return (
    <section>
      <h2>{artist.display_name}</h2>
      {artist.bio && <p className="notice" style={{ marginTop: 8 }}>{artist.bio}</p>}
      <div style={{ marginTop: 24 }}>
        {tracks.length === 0 && <p className="notice">Ingen numre udgivet endnu.</p>}
        {tracks.map((t) => (
          <div className="track-row" key={t.id}>
            <div className="ttitle">
              {t.title}
              <div className="notice">{t.genre}</div>
            </div>
            {t.url ? (
              <audio controls preload="none" src={t.url} />
            ) : (
              <span className="notice">Lydfilen kunne ikke hentes. Opdatér siden.</span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
