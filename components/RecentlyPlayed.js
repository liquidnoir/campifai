'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { imagePublicUrl } from '../lib/shared'
import { formatPlayedAgo } from '../lib/recentFormat'
import { useLanguage } from './LanguageProvider'

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

// "Senest afspillet" på forsiden: den indloggede brugers egne senest afspillede udgivelser,
// i en række man kan trække i sidelæns. Vises slet ikke, hvis der ikke er nogen endnu.
export default function RecentlyPlayed({ userId }) {
  const { t, lang } = useLanguage()
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!userId) {
      setItems([])
      return
    }
    let active = true
    supabase.rpc('my_recent_releases', { p_limit: 10 }).then(({ data, error }) => {
      if (!active) return
      setItems(error ? [] : data || [])
    })
    return () => {
      active = false
    }
  }, [userId])

  if (items.length === 0) return null

  return (
    <section style={{ paddingBottom: 0 }}>
      <div className="section-head">
        <h2>{t('home.recent.title')}</h2>
      </div>
      <div className="recent-row">
        {items.map((item) => (
          <Link href={`/release/${item.releaseId}`} key={item.releaseId} className="sleeve recent-item">
            <Cover imageUrl={imagePublicUrl(supabase, item.coverPath)} color={item.color} label={item.title} />
            <div className="meta">
              <div className="artist">{item.artist || t('home.unknownArtist')}</div>
              <div className="sub">
                {item.title} · {t(`type.${item.type}`)}
              </div>
              <div className="sub">
                {formatPlayedAgo(item.lastPlayedAt, { lang, justNow: t('home.recent.justNow') })}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
