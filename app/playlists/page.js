'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../components/LanguageProvider'
import { useConfirm } from '../../components/ConfirmProvider'
import EmptyState from '../../components/EmptyState'
import { ListSkeleton } from '../../components/Skeletons'
import { useFavorites } from '../../components/FavoritesProvider'

export default function PlaylistsPage() {
  const { t } = useLanguage()
  const confirm = useConfirm()
  const router = useRouter()
  const favorites = useFavorites()
  const [session, setSession] = useState(undefined)
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
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
    load()
  }, [session])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('playlists')
      .select('id, title, created_at, playlist_tracks ( count )')
      .order('created_at', { ascending: false })
    setPlaylists(data || [])
    setLoading(false)
  }

  async function createPlaylist(e) {
    e.preventDefault()
    setError('')
    const title = newTitle.trim()
    if (!title) {
      setError(t('playlists.nameRequired'))
      return
    }
    setCreating(true)
    const { error: insertError } = await supabase.from('playlists').insert({ title })
    setCreating(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setNewTitle('')
    load()
  }

  async function deletePlaylist(p) {
    if (!(await confirm(t('playlists.deleteConfirm', { title: p.title }), { label: t('common.delete'), danger: true }))) return
    await supabase.from('playlists').delete().eq('id', p.id)
    load()
  }

  if (session === undefined || loading) return <ListSkeleton />

  return (
    <section>
      <h2>{t('playlists.title')}</h2>

      <Link href="/favorites" className="fav-card panel">
        <span className="fav-card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.8 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.3 3.3 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" /></svg>
        </span>
        <span>
          <span className="fav-card-title">{t('favorites.title')}</span>
          {favorites.ready && <span className="notice fav-card-sub">{t('release.trackCount', { count: favorites.count })}</span>}
        </span>
      </Link>

      <div className="panel" style={{ maxWidth: 480, marginTop: 20, marginBottom: 28 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>{t('playlists.createTitle')}</h3>
        <form onSubmit={createPlaylist}>
          <div className="field">
            <label>{t('signup.name')}</label>
            <input maxLength={100} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn" type="submit" disabled={creating}>
            {creating ? t('common.saving') : t('playlists.createButton')}
          </button>
        </form>
      </div>

      {playlists.length === 0 && (
        <EmptyState text={t('playlists.empty')} hint={t('playlists.emptyHint')} href="/" action={t('playlists.emptyAction')} />
      )}
      {playlists.map((p) => (
        <div className="track-row" key={p.id}>
          <div className="ttitle">
            <Link href={`/playlists/${p.id}`}>{p.title}</Link>
            <div className="notice">{t('release.trackCount', { count: p.playlist_tracks?.[0]?.count ?? 0 })}</div>
          </div>
          <button className="btn ghost" type="button" onClick={() => deletePlaylist(p)}>
            {t('common.delete')}
          </button>
        </div>
      ))}
    </section>
  )
}
