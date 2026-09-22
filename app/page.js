'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [session, setSession] = useState(undefined)
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    loadTracks()
  }, [])

  async function loadTracks() {
    const { data, error } = await supabase
      .from('tracks')
      .select('id, title, genre, color, artist_id, artists ( name )')
      .order('created_at', { ascending: false })
    if (!error && data) setTracks(data)
    setLoading(false)
  }

  return (
    <div>
      <section className="hero">
        <h1>Musik, direkte fra kunstneren til dig.</h1>
        <p>Campifai er et sted hvor publishers lægger deres kunstneres musik op, og alle med en konto kan lytte gratis.</p>
        {session === null && (
          <p className="notice" style={{ marginTop: 8 }}>
            Du kan gennemse kataloget herunder. <Link href="/login">Log ind</Link> eller{' '}
            <Link href="/signup">opret en konto</Link> for at lytte.
          </p>
        )}
      </section>
      <section>
        <div className="section-head"><h2>Nye numre</h2></div>
        {loading && <p className="notice">Henter musik...</p>}
        {!loading && tracks.length === 0 && (
          <p className="notice">Ingen numre endnu. Opret en publisher-konto og vær den første til at uploade.</p>
        )}
        <div className="grid">
          {tracks.map((t) => (
            <Link href={`/artist/${t.artist_id}`} key={t.id} className="sleeve">
              <div className="cover" style={{ background: t.color || '#B8452B' }}>
                <span className="title">{t.title}</span>
              </div>
              <div className="meta">
                <div className="artist">{t.artists?.name || 'Ukendt kunstner'}</div>
                <div className="sub">{t.genre}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
