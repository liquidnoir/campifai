'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../components/LanguageProvider'

export default function PlaylistsPage() {
  const { t } = useLanguage()
  const router = useRouter()
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
    if (!window.confirm(t('playlists.deleteConfirm', { title: p.title }))) return
    await supabase.from('playlists').delete().eq('id', p.id)
    load()
  }

  if (session === undefined || loading) return <p className="notice">{t('common.loading')}</p>

  return (
    <section>
      <h2>{t('playlists.title')}</h2>

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

      {playlists.length === 0 && <p className="notice">{t('playlists.empty')}</p>}
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
