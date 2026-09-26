'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { controlStyle, imagePublicUrl } from '../lib/shared'
import { collectionTitle } from '../lib/collections'
import { useLanguage } from '../components/LanguageProvider'

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
  const { t } = useLanguage()
  const [session, setSession] = useState(undefined)
  const [releases, setReleases] = useState([])
  const [artists, setArtists] = useState([])
  const [tracks, setTracks] = useState([])
  const [topTracks, setTopTracks] = useState([])
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    loadHome()
  }, [])

  async function loadHome() {
    const [releasesRes, artistsRes, tracksRes, topTracksRes, collectionsRes] = await Promise.all([
      supabase
        .from('releases')
        .select('id, title, type, color, cover_path, genre, artist_id, artists ( name )')
        .order('created_at', { ascending: false }),
      supabase.from('artists').select('id, name, image_path').order('name', { ascending: true }),
      supabase.from('tracks').select('id, title, release_id'),
      supabase
        .from('tracks')
        .select('id, title, play_count, release_id, releases ( title, artist_id, artists ( name ) )')
        .gt('play_count', 0)
        .order('play_count', { ascending: false })
        .limit(10),
      supabase
        .from('collections')
        .select('id, season, year, title, cover_path, collection_releases ( count )')
        .eq('enabled', true)
        .order('year', { ascending: false })
        .order('season', { ascending: true }),
    ])
    if (!releasesRes.error && releasesRes.data) setReleases(releasesRes.data)
    if (!artistsRes.error && artistsRes.data) setArtists(artistsRes.data)
    if (!tracksRes.error && tracksRes.data) setTracks(tracksRes.data)
    if (!topTracksRes.error && topTracksRes.data) setTopTracks(topTracksRes.data)
    if (!collectionsRes.error && collectionsRes.data) setCollections(collectionsRes.data)
    setLoading(false)
  }

  const tracksByRelease = useMemo(() => {
    const map = {}
    for (const tr of tracks) {
      if (!map[tr.release_id]) map[tr.release_id] = []
      map[tr.release_id].push(tr)
    }
    return map
  }, [tracks])

  const q = query.trim().toLowerCase()
  const searching = q.length > 0

  const filteredReleases = useMemo(() => {
    if (!searching) return []
    return releases.filter((r) => {
      if (r.title.toLowerCase().includes(q)) return true
      if ((r.artists?.name || '').toLowerCase().includes(q)) return true
      if ((r.genre || '').toLowerCase().includes(q)) return true
      const relTracks = tracksByRelease[r.id] || []
      return relTracks.some((tr) => tr.title.toLowerCase().includes(q))
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
            <h1>{t('home.hero.title')}</h1>
            <p>{t('home.hero.body')}</p>
            {session === null && (
              <p className="notice" style={{ marginTop: 8 }}>
                {t('home.hero.guestNotice.pre')} <Link href="/login">{t('home.hero.guestLogin')}</Link>{' '}
                {t('home.hero.guestNotice.or')} <Link href="/signup">{t('home.hero.guestSignup')}</Link>{' '}
                {t('home.hero.guestNotice.post')}
              </p>
            )}
          </div>
          <div className="hero-art">
            <img
              src="/hero-mushrooms.jpg"
              alt=""
              style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 3 }}
            />
          </div>
        </div>
      </section>

      <section style={{ paddingBottom: 0 }}>
        <div className="field" style={{ maxWidth: 420, margin: 0 }}>
          <label htmlFor="search">{t('home.search.label')}</label>
          <input
            id="search"
            style={controlStyle}
            placeholder={t('home.search.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </section>

      {searching ? (
        <section>
          <div className="section-head">
            <h2>{t('home.releases.title')}</h2>
          </div>
          {loading && <p className="notice">{t('common.loading')}</p>}
          {!loading && filteredReleases.length === 0 && (
            <p className="notice">{t('home.releases.noMatch', { query })}</p>
          )}
          <div className="grid">
            {filteredReleases.map((r) => (
              <Link href={`/release/${r.id}`} key={r.id} className="sleeve">
                <CoverTile imageUrl={imagePublicUrl(supabase, r.cover_path)} color={r.color} label={r.title} />
                <div className="meta">
                  <div className="artist">{r.artists?.name || t('home.unknownArtist')}</div>
                  <div className="sub">
                    {r.title} · {t(`type.${r.type}`) || r.type}
                    {r.genre ? ` · ${r.genre}` : ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section>
          <div className="section-head">
            <h2>{t('home.collections.title')}</h2>
          </div>
          {loading && <p className="notice">{t('common.loading')}</p>}
          {!loading && collections.length === 0 && <p className="notice">{t('home.collections.empty')}</p>}
          <div className="grid">
            {collections.map((c) => (
              <Link href={`/collections/${c.id}`} key={c.id} className="sleeve">
                <CoverTile imageUrl={imagePublicUrl(supabase, c.cover_path)} label={collectionTitle(c, t)} />
                <div className="meta">
                  <div className="artist">{collectionTitle(c, t)}</div>
                  <div className="sub">
                    {t('home.collections.releaseCount', { count: c.collection_releases?.[0]?.count ?? 0 })}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!searching && topTracks.length > 0 && (
        <section style={{ marginTop: 8 }}>
          <div className="section-head"><h2>{t('home.topTracks.title')}</h2></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {topTracks.map((tr, i) => (
              <Link
                href={`/release/${tr.release_id}?t=${tr.id}`}
                key={tr.id}
                className="track-row"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="notice" style={{ width: 20, flexShrink: 0, textAlign: 'right' }}>{i + 1}</div>
                <div className="ttitle">
                  {tr.title}
                  <div className="notice">
                    {tr.releases?.artists?.name || t('home.unknownArtist')} · {tr.releases?.title}
                  </div>
                </div>
                <div className="notice" style={{ flexShrink: 0 }}>
                  {t(tr.play_count === 1 ? 'home.topTracks.play_one' : 'home.topTracks.play_other', {
                    count: tr.play_count,
                  })}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginTop: searching ? 0 : 40 }}>
        <div className="section-head">
          <h2>{searching ? t('home.artists.title') : t('home.artists.allTitle')}</h2>
        </div>
        {!loading && searching && filteredArtists.length === 0 && (
          <p className="notice">{t('home.artists.noMatch', { query })}</p>
        )}
        {!loading && !searching && artists.length === 0 && <p className="notice">{t('home.artists.empty')}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filteredArtists.map((a) => (
            <ArtistRow artist={a} key={a.id} />
          ))}
        </div>
      </section>
    </div>
  )
}
