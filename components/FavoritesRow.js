'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { imagePublicUrl } from '../lib/shared'
import { useLanguage } from './LanguageProvider'
import { useFavorites } from './FavoritesProvider'

function Cover({ imageUrl, color, label }) {
  if (imageUrl) {
    return (
      <div
        className="cover"
        style={{ backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
    )
  }
  return (
    <div className="cover" style={{ background: color || '#B8452B' }}>
      <span className="title">{label}</span>
    </div>
  )
}

// "Dine favoritter" på forsiden: de nyeste hjertemarkerede numre i en række, man kan trække i sidelæns.
// Et tryk fører til udgivelsen med nummeret markeret. Vises slet ikke, hvis man ingen favoritter har.
export default function FavoritesRow() {
  const { t } = useLanguage()
  const { loggedIn, ready, count } = useFavorites()
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!loggedIn || !ready || count === 0) return undefined
    let active = true
    supabase
      .from('favorites')
      .select('created_at, tracks ( id, title, release_id, artists ( name ), releases ( title, color, cover_path, artists ( name ) ) )')
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data, error }) => {
        if (!active) return
        setItems(error ? [] : (data || []).filter((row) => row.tracks && row.tracks.release_id).map((row) => row.tracks))
      })
    return () => {
      active = false
    }
    // Hentes igen, når man får den første favorit, men ikke ved hvert hjerte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, ready, count === 0])

  if (!loggedIn || count === 0 || items.length === 0) return null

  return (
    <section style={{ paddingBottom: 0 }}>
      <div className="section-head">
        <h2>{t('home.favorites.title')}</h2>
        <Link href="/favorites" className="notice">{t('favorites.seeAll')}</Link>
      </div>
      <div className="recent-row">
        {items.map((track) => (
          <Link href={`/release/${track.release_id}?t=${track.id}`} key={track.id} className="sleeve recent-item">
            <Cover imageUrl={imagePublicUrl(supabase, track.releases?.cover_path)} color={track.releases?.color} label={track.releases?.title} />
            <div className="meta">
              <div className="artist">{track.title}</div>
              <div className="sub">{track.artists?.name || track.releases?.artists?.name || t('home.unknownArtist')}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
