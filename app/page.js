'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { RELEASE_TYPE_LABELS, imagePublicUrl } from '../lib/shared'
import HeroArt from '../components/HeroArt'
import WaveDivider from '../components/WaveDivider'

function CoverTile({ imageUrl, color, label }) {
  if (imageUrl) {
    return (
      <div
        className="cover"
        style={{
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
    )
  }
  return (
    <div className="cover" style={{ background: color || '#B8452B' }}>
      <span className="title">{label}</span>
    </div>
  )
}

function ArtistAvatar({ imageUrl, name }) {
  const style = {
    width: 56,
    height: 56,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontFamily: 'var(--font-display, serif)',
    fontSize: 18,
    overflow: 'hidden',
  }
  if (imageUrl) {
    return (
      <div
        style={{ ...style, backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
    )
  }
  return (
    <div style={{ ...style, background: '#4B5A3E' }}>
      {(name || '?').trim().charAt(0).toUpperCase()}
    </div>
  )
}

export default function Home() {
  const [session, setSession] = useState(undefined)
  const [releases, setReleases] = useState([])
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    loadHome()
  }, [])

  async function loadHome() {
    const [releasesRes, artistsRes] = await Promise.all([
      supabase
        .from('releases')
        .select('id, title, type, color, cover_path, artist_id, artists ( name )')
        .order('created_at', { ascending: false })
        .limit(24),
      supabase.from('artists').select('id, name, image_path').order('name', { ascending: true }),
    ])
    if (!releasesRes.error && releasesRes.data) setReleases(releasesRes.data)
    if (!artistsRes.error && artistsRes.data) setArtists(artistsRes.data)
    setLoading(false)
  }

  return (
    <div>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <h1>Musik, direkte fra kunstneren til dig.</h1>
            <p>Campifai er et sted hvor publishers lægger deres kunstneres musik op, og alle med en konto kan lytte gratis.</p>
            {session === null && (
              <p className="notice" style={{ marginTop: 8 }}>
                Du kan gennemse kataloget herunder. <Link href="/login">Log ind</Link> eller{' '}
                <Link href="/signup">opret en konto</Link> for at lytte.
              </p>
            )}
          </div>
          <div className="hero-art">
            <HeroArt />
          </div>
        </div>
        <div className="wave-divider">
          <WaveDivider />
        </div>
      </section>

      <section>
        <div className="section-head"><h2>Nye udgivelser</h2></div>
        {loading && <p className="notice">Henter musik...</p>}
        {!loading && releases.length === 0 && (
          <p className="notice">Ingen udgivelser endnu. Opret en publisher-konto og vær den første til at udgive.</p>
        )}
        <div className="grid">
          {releases.map((r) => (
            <Link href={`/release/${r.id}`} key={r.id} className="sleeve">
              <CoverTile imageUrl={imagePublicUrl(supabase, r.cover_path)} color={r.color} label={r.title} />
              <div className="meta">
                <div className="artist">{r.artists?.name || 'Ukendt kunstner'}</div>
                <div className="sub">{r.title} · {RELEASE_TYPE_LABELS[r.type] || r.type}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <div className="section-head"><h2>Alle kunstnere</h2></div>
        {!loading && artists.length === 0 && <p className="notice">Ingen kunstnere endnu.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {artists.map((a) => (
            <Link
              href={`/artist/${a.id}`}
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '10px 4px',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <ArtistAvatar imageUrl={imagePublicUrl(supabase, a.image_path)} name={a.name} />
              <span>{a.name}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
