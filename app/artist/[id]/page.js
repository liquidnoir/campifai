'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

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

    const withUrls = (trackData || []).map((t) => ({
      ...t,
      url: supabase.storage.from('tracks').getPublicUrl(t.audio_path).data.publicUrl,
    }))
    setTracks(withUrls)
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
            <audio controls src={t.url} />
          </div>
        ))}
      </div>
    </section>
  )
}
