'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { RELEASE_TYPE_LABELS, controlStyle, imagePublicUrl } from '../lib/shared'
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

function ArtistRow({ artist }) {
  return (
    <Link
      href={`/artist/${artist.id}`}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 4px', textDecoration: 'none', color: 'inherit' }}
    >
      <ArtistAvatar imageUrl={imagePublicUrl(supabase, artist.image_path)} name={artist.name} />
      <span>{artist.name}</span>
    </Link>
  )
}

export default function Home() {
  const [session, setSession] = useState(undefined)
  const [releases, setReleases] = useState([])
  const [artists, setArtists] = useState([])
  const [tracks, setTracks] = useState([])
  const [topTracks, setTopTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    loadHome()
  }, [])

  async function loadHome() {
    const [releasesRes, artistsRes, tracksRes, topTracksRes] = await Promise.all([
      supabase
        .from('releases')
        .select('id, title, type, color, cover_path, artist_id, artists ( name )')
        .order('created_at', { ascending: false }),
      supabase.from('artists').select('id, name, image_path').order('name', { ascending: true }),
      supabase.from('tracks').select('id, title, genre, release_id'),
      supabase
        .from('tracks')
        .select('id, title, play_count, release_id, releases ( title, artist_id, artists ( name ) )')
        .gt('play_count', 0)
        .order('play_count', { ascending: false })
        .limit(10),
    ])
    if (!releasesRes.error && releasesRes.data) setReleases(releasesRes.data)
    if (!artistsRes.error && artistsRes.data) setArtists(artistsRes.data)
    if (!tracksRes.error && tracksRes.data) setTracks(tracksRes.data)
    if (!topTracksRes.error && topTracksRes.data) setTopTracks(topTracksRes.data)
    setLoading(false)
  }

  const tracksByRelease = useMemo(() => {
    const map = {}
    for (const t of tracks) {
      if (!map[t.release_id]) map[t.release_id] = []
      map[t.release_id].push(t)
    }
    return map
  }, [tracks])

  const q = query.trim().toLowerCase()
  const searching = q.length > 0

  const filteredReleases = useMemo(() => {
    if (!searching) return releases.slice(0, 24)
    return releases.filter((r) => {
      if (r.title.toLowerCase().includes(q)) return true
      if ((r.artists?.name || '').toLowerCase().includes(q)) return true
      const relTracks = tracksByRelease[r.id] || []
      return relTracks.some(
        (t) => t.title.toLowerCase().includes(q) || (t.genre || '').toLowerCase().includes(q)
      )
    })
  }, [releases, tracksByRelease, q, searching])

  const filteredArtists = useMemo(() => {
    if (!searching) return artists
    return artists.filter((a) => a.name.toLowerCase().includes(q))
  }, [artists, q, searching])

  return (
    <div>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <h1>Great ideas don&apos;t care about genres—or who made them.</h1>
            <p>
              Campifai is the curated sanctuary for AI-generated music that otherwise has no home. Listen
              for free, discover groundbreaking sound, and help give these innovative works the stage they
              deserve.
            </p>
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

      <section style={{ paddingBottom: 0 }}>
        <div className="field" style={{ maxWidth: 420, margin: 0 }}>
          <label htmlFor="search">Søg</label>
          <input
            id="search"
            style={controlStyle}
            placeholder="Kunstner, sang, udgivelse eller genre"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>{searching ? 'Udgivelser' : 'Nye udgivelser'}</h2>
        </div>
        {loading && <p className="notice">Henter musik...</p>}
        {!loading && searching && filteredReleases.length === 0 && (
          <p className="notice">Ingen udgivelser matcher "{query}".</p>
        )}
        {!loading && !searching && releases.length === 0 && (
          <p className="notice">Ingen udgivelser endnu. Opret en publisher-konto og vær den første til at udgive.</p>
        )}
        <div className="grid">
          {filteredReleases.map((r) => (
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

      {!searching && topTracks.length > 0 && (
        <section style={{ marginTop: 8 }}>
          <div className="section-head"><h2>Mest spillede numre</h2></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {topTracks.map((t, i) => (
              <Link
                href={`/release/${t.release_id}?t=${t.id}`}
                key={t.id}
                className="track-row"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="notice" style={{ width: 20, flexShrink: 0, textAlign: 'right' }}>{i + 1}</div>
                <div className="ttitle">
                  {t.title}
                  <div className="notice">
                    {t.releases?.artists?.name || 'Ukendt kunstner'} · {t.releases?.title}
                  </div>
                </div>
                <div className="notice" style={{ flexShrink: 0 }}>
                  {t.play_count} {t.play_count === 1 ? 'afspilning' : 'afspilninger'}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginTop: searching ? 0 : 40 }}>
        <div className="section-head">
          <h2>{searching ? 'Kunstnere' : 'Alle kunstnere'}</h2>
        </div>
        {!loading && searching && filteredArtists.length === 0 && (
          <p className="notice">Ingen kunstnere matcher "{query}".</p>
        )}
        {!loading && !searching && artists.length === 0 && <p className="notice">Ingen kunstnere endnu.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filteredArtists.map((a) => (
            <ArtistRow artist={a} key={a.id} />
          ))}
        </div>
      </section>
    </div>
  )
}
