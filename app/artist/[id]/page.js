'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { imagePublicUrl } from '../../../lib/shared'
import { useLanguage } from '../../../components/LanguageProvider'

export default function ArtistPage() {
  const { t } = useLanguage()
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
      .select('id, name, bio, image_path, publisher_id, profiles ( display_name )')
      .eq('id', id)
      .single()
    setArtist(artistData)

    if (!artistData) {
      setLoading(false)
      return
    }

    const { data: releaseData } = await supabase
      .from('releases')
      .select('*, tracks ( count )')
      .eq('artist_id', id)
      .order('created_at', { ascending: false })
    setReleases(releaseData || [])
    setLoading(false)
  }

  if (loading) return <p className="notice">{t('common.loading')}</p>
  if (!artist) return <p className="notice">{t('artist.notFound')}</p>

  const avatarUrl = imagePublicUrl(supabase, artist.image_path)
  const publisherName = artist.profiles?.display_name
  const showPublisher = publisherName && publisherName.trim().toLowerCase() !== artist.name.trim().toLowerCase()

  return (
    <section>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            flexShrink: 0,
            background: avatarUrl ? undefined : '#4B5A3E',
            backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 28,
          }}
        >
          {!avatarUrl && artist.name.trim().charAt(0).toUpperCase()}
        </div>
        <div>
          <h2>{artist.name}</h2>
          {showPublisher && (
            <p className="notice" style={{ marginTop: 4 }}>{t('artist.publishedBy', { name: publisherName })}</p>
          )}
        </div>
      </div>
      {artist.bio && <p className="notice" style={{ marginTop: 16 }}>{artist.bio}</p>}

      <div style={{ marginTop: 28 }}>
        {releases.length === 0 && <p className="notice">{t('artist.noReleases')}</p>}
        <div className="grid">
          {releases.map((r) => {
            const coverUrl = imagePublicUrl(supabase, r.cover_path)
            return (
              <Link href={`/release/${r.id}`} key={r.id} className="sleeve">
                <div
                  className="cover"
                  style={{
                    background: coverUrl ? undefined : r.color || '#B8452B',
                    backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {!coverUrl && <span className="title">{r.title}</span>}
                </div>
                <div className="meta">
                  <div className="artist">{r.title}</div>
                  <div className="sub">
                    {t(`type.${r.type}`) || r.type} · {t('release.trackCount', { count: r.tracks?.[0]?.count ?? 0 })}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
