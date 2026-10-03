'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { imagePublicUrl } from '../../../lib/shared'
import { useLanguage } from '../../../components/LanguageProvider'

function Thumb({ url, color }) {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 8,
        flexShrink: 0,
        background: url ? undefined : color || '#B8452B',
        backgroundImage: url ? `url(${url})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
  )
}

export default function AdminReleasesPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [session, setSession] = useState(undefined)
  const [me, setMe] = useState(null)
  const [checked, setChecked] = useState(false)
  const [releases, setReleases] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (session === null) {
      router.replace('/login')
      return
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  async function init() {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setMe(data || null)
    if (data?.role === 'admin') await load()
    setChecked(true)
  }

  async function load() {
    const { data, error: loadError } = await supabase
      .from('releases')
      .select(
        'id, title, type, genre, color, cover_path, created_at, artists ( name ), profiles ( display_name ), tracks ( count )'
      )
      .order('created_at', { ascending: false })
    if (loadError) {
      setError(loadError.message)
      return
    }
    setReleases(data || [])
  }

  if (session === undefined || !checked) return <p className="notice">{t('common.loading')}</p>
  if (me?.role !== 'admin') {
    return (
      <section>
        <h2>{t('adminReleases.title')}</h2>
        <p className="notice" style={{ marginTop: 12 }}>{t('admin.noAccess')}</p>
      </section>
    )
  }

  const q = search.trim().toLowerCase()
  const shown = releases.filter(
    (r) =>
      !q ||
      r.title.toLowerCase().includes(q) ||
      (r.artists?.name || '').toLowerCase().includes(q) ||
      (r.profiles?.display_name || '').toLowerCase().includes(q)
  )

  return (
    <section>
      <p style={{ marginBottom: 8 }}>
        <Link href="/admin">← {t('nav.admin')}</Link>
      </p>
      <h2>{t('adminReleases.title')}</h2>
      <p className="notice" style={{ marginTop: 8 }}>{t('adminReleases.intro')}</p>

      <div className="field" style={{ maxWidth: 420, marginTop: 20 }}>
        <input
          placeholder={t('adminReleases.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="error-msg">{error}</div>}
      {shown.length === 0 && !error && <p className="notice">{t('adminReleases.none')}</p>}

      {shown.map((r) => (
        <div className="track-row" key={r.id}>
          <div className="ttitle" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Thumb url={imagePublicUrl(supabase, r.cover_path)} color={r.color} />
            <div>
              <Link href={`/admin/releases/${r.id}`}>{r.title}</Link>
              <div className="notice">
                {r.artists?.name || t('home.unknownArtist')} · {t(`type.${r.type}`)}
                {r.genre ? ` · ${r.genre}` : ''} · {t('release.trackCount', { count: r.tracks?.[0]?.count ?? 0 })}
              </div>
              <div className="notice">{t('artist.publishedBy', { name: r.profiles?.display_name || t('admin.unknown') })}</div>
            </div>
          </div>
          <Link href={`/admin/releases/${r.id}`} className="btn ghost">
            {t('common.edit')}
          </Link>
        </div>
      ))}
    </section>
  )
}
