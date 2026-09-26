'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { controlStyle, removeFolderFiles, removeFolderImages } from '../../lib/shared'
import { useLanguage } from '../../components/LanguageProvider'

function Msg({ msg }) {
  if (!msg) return null
  if (msg.type === 'error') return <div className="error-msg">{msg.text}</div>
  return <div style={{ color: '#4B5A3E', fontSize: 14, marginBottom: 12 }}>{msg.text}</div>
}

function formatDate(value, lang) {
  return value ? new Date(value).toLocaleDateString(lang === 'da' ? 'da-DK' : 'en-GB') : ''
}

const gridStyle = {
  display: 'grid',
  gap: 10,
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
}

export default function AdminPage() {
  const { t, lang } = useLanguage()
  const router = useRouter()
  const [session, setSession] = useState(undefined)
  const [me, setMe] = useState(null)
  const [checked, setChecked] = useState(false)
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [artists, setArtists] = useState([])
  const [search, setSearch] = useState('')
  const [userEdits, setUserEdits] = useState({})
  const [artistEdits, setArtistEdits] = useState({})
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState('')

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
  }, [session])

  async function init() {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setMe(data || null)
    if (data?.role === 'admin') {
      await Promise.all([loadUsers(), loadArtists()])
    }
    setChecked(true)
  }

  async function loadUsers() {
    const { data, error } = await supabase.rpc('admin_list_users')
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    setUsers(data || [])
    setUserEdits({})
  }

  async function loadArtists() {
    const { data, error } = await supabase
      .from('artists')
      .select(
        'id, name, bio, image_path, publisher_id, created_at, profiles ( display_name ), releases ( id, cover_path ), tracks ( count )'
      )
      .order('created_at', { ascending: false })
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    setArtists(data || [])
    setArtistEdits({})
  }

  // ----- Brugere -----
  function userValue(u, field) {
    return userEdits[u.id]?.[field] ?? u[field] ?? ''
  }

  function setUserField(u, field, value) {
    setUserEdits((prev) => ({ ...prev, [u.id]: { ...prev[u.id], [field]: value } }))
  }

  function userDirty(u) {
    const e = userEdits[u.id]
    if (!e) return false
    const nameChanged = e.display_name !== undefined && e.display_name.trim() !== u.display_name
    const roleChanged = e.role !== undefined && e.role !== u.role
    return nameChanged || roleChanged
  }

  async function saveUser(u) {
    setMsg(null)
    const name = userValue(u, 'display_name').trim()
    const role = userValue(u, 'role')
    if (!name) {
      setMsg({ type: 'error', text: t('account.nameEmpty') })
      return
    }
    if (role !== u.role && role === 'admin') {
      if (!window.confirm(t('admin.confirmMakeAdmin', { name: u.display_name }))) return
    }
    setBusy(u.id)
    const changes = { display_name: name }
    if (role !== u.role) changes.role = role
    const { error } = await supabase.from('profiles').update(changes).eq('id', u.id)
    setBusy('')
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    setMsg({ type: 'ok', text: t('admin.updated', { name }) })
    await loadUsers()
  }

  async function deleteUser(u) {
    setMsg(null)
    if (u.id === session.user.id) return
    if (u.role === 'admin') {
      setMsg({ type: 'error', text: t('admin.removeAdminRoleFirst') })
      return
    }
    const parts = [t('admin.deleteUserPrefix', { name: u.display_name, email: u.email })]
    if (u.artist_count > 0) parts.push(t('admin.artistCount', { count: u.artist_count }))
    if (u.release_count > 0) parts.push(t('dashboard.artists.releaseCount', { count: u.release_count }))
    if (u.track_count > 0) parts.push(t('release.trackCount', { count: u.track_count }))
    const question = parts.join(', ') + t('admin.cannotBeUndoneSuffix')
    if (!window.confirm(question)) return
    setBusy(u.id)
    try {
      await removeFolderFiles(supabase, u.id, t)
      await removeFolderImages(supabase, u.id, t)
      const { error } = await supabase.rpc('admin_delete_user', { target: u.id })
      if (error) throw error
      setMsg({ type: 'ok', text: t('admin.deleted', { name: u.display_name }) })
      await Promise.all([loadUsers(), loadArtists()])
    } catch (err) {
      setMsg({ type: 'error', text: err.message || t('common.somethingWrong') })
    }
    setBusy('')
  }

  // ----- Kunstnere -----
  function artistValue(a, field) {
    return artistEdits[a.id]?.[field] ?? a[field] ?? ''
  }

  function setArtistField(a, field, value) {
    setArtistEdits((prev) => ({ ...prev, [a.id]: { ...prev[a.id], [field]: value } }))
  }

  function artistDirty(a) {
    const e = artistEdits[a.id]
    if (!e) return false
    const nameChanged = e.name !== undefined && e.name.trim() !== a.name
    const bioChanged = e.bio !== undefined && e.bio.trim() !== (a.bio || '')
    return nameChanged || bioChanged
  }

  async function saveArtist(a) {
    setMsg(null)
    const name = artistValue(a, 'name').trim()
    const bio = artistValue(a, 'bio').trim()
    if (!name) {
      setMsg({ type: 'error', text: t('account.nameEmpty') })
      return
    }
    setBusy(a.id)
    const { error } = await supabase
      .from('artists')
      .update({ name, bio: bio || null })
      .eq('id', a.id)
    setBusy('')
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    setMsg({ type: 'ok', text: t('admin.updated', { name }) })
    await loadArtists()
  }

  async function deleteArtist(a) {
    setMsg(null)
    const trackCount = a.tracks?.[0]?.count ?? 0
    const releaseCount = a.releases?.length ?? 0
    const question =
      trackCount > 0
        ? t('dashboard.artists.deleteConfirmWithContent', { name: a.name, releases: releaseCount, tracks: trackCount })
        : t('dashboard.deleteConfirmNamed', { name: a.name })
    if (!window.confirm(question)) return
    setBusy(a.id)
    try {
      const { data: own, error: listError } = await supabase
        .from('tracks')
        .select('audio_path')
        .eq('artist_id', a.id)
      if (listError) throw listError
      if (own && own.length > 0) {
        const { error: removeError } = await supabase.storage
          .from('tracks')
          .remove(own.map((t) => t.audio_path))
        if (removeError) throw removeError
      }
      const coverPaths = (a.releases || []).map((r) => r.cover_path).filter(Boolean)
      const imagePaths = [a.image_path, ...coverPaths].filter(Boolean)
      if (imagePaths.length > 0) {
        const { error: imgError } = await supabase.storage.from('images').remove(imagePaths)
        if (imgError) throw imgError
      }
      const { error } = await supabase.from('artists').delete().eq('id', a.id)
      if (error) throw error
      setMsg({ type: 'ok', text: t('admin.deleted', { name: a.name }) })
      await Promise.all([loadArtists(), loadUsers()])
    } catch (err) {
      setMsg({ type: 'error', text: err.message || t('common.somethingWrong') })
    }
    setBusy('')
  }

  if (session === undefined || !checked) return <p className="notice">{t('common.loading')}</p>
  if (me?.role !== 'admin') {
    return (
      <section>
        <h2>{t('nav.admin')}</h2>
        <p className="notice" style={{ marginTop: 12 }}>{t('admin.noAccess')}</p>
      </section>
    )
  }

  const q = search.trim().toLowerCase()
  const shownUsers = users.filter(
    (u) =>
      !q ||
      u.display_name.toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
  )
  const shownArtists = artists.filter(
    (a) =>
      !q ||
      a.name.toLowerCase().includes(q) ||
      (a.profiles?.display_name || '').toLowerCase().includes(q)
  )
  const countRole = (role) => users.filter((u) => u.role === role).length

  return (
    <section>
      <h2>{t('nav.admin')}</h2>
      <p className="notice" style={{ marginTop: 8 }}>
        {t('admin.summary', {
          listeners: countRole('listener'),
          publishers: countRole('publisher'),
          admins: countRole('admin'),
          artists: artists.length,
        })}
      </p>

      <div style={{ display: 'flex', gap: 8, margin: '20px 0 12px' }}>
        <button className={tab === 'users' ? 'btn' : 'btn ghost'} onClick={() => setTab('users')}>
          {t('admin.tabs.users', { count: users.length })}
        </button>
        <button className={tab === 'artists' ? 'btn' : 'btn ghost'} onClick={() => setTab('artists')}>
          {t('admin.tabs.artists', { count: artists.length })}
        </button>
        <Link href="/admin/collections" className="btn ghost">
          {t('admin.collectionsLink')}
        </Link>
      </div>

      <div className="field" style={{ maxWidth: 420 }}>
        <input
          placeholder={tab === 'users' ? t('admin.searchUsers') : t('admin.searchArtists')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Msg msg={msg} />

      {tab === 'users' && (
        <div>
          {shownUsers.length === 0 && <p className="notice">{t('admin.noUsersFound')}</p>}
          {shownUsers.map((u) => {
            const isMe = u.id === session.user.id
            const isAdminUser = u.role === 'admin'
            return (
              <div className="panel" key={u.id} style={{ marginBottom: 12 }}>
                <div style={gridStyle}>
                  <div className="field" style={{ margin: 0 }}>
                    <label>{t('signup.name')}{isMe ? ` ${t('admin.youSuffix')}` : ''}</label>
                    <input
                      maxLength={60}
                      value={userValue(u, 'display_name')}
                      onChange={(e) => setUserField(u, 'display_name', e.target.value)}
                    />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>{t('admin.role')}</label>
                    <select
                      style={controlStyle}
                      value={userValue(u, 'role')}
                      disabled={isMe}
                      onChange={(e) => setUserField(u, 'role', e.target.value)}
                    >
                      <option value="listener">{t('role.listener')}</option>
                      <option value="publisher">{t('role.publisher')}</option>
                      <option value="admin">{t('role.admin')}</option>
                    </select>
                  </div>
                </div>
                <div className="notice" style={{ marginTop: 8 }}>
                  {t('admin.userMeta', {
                    email: u.email,
                    date: formatDate(u.created_at, lang),
                    artists: u.artist_count,
                    releases: u.release_count,
                    tracks: u.track_count,
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button
                    className="btn"
                    type="button"
                    disabled={!userDirty(u) || busy === u.id}
                    onClick={() => saveUser(u)}
                  >
                    {busy === u.id ? t('admin.working') : t('common.save')}
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    disabled={isMe || isAdminUser || busy === u.id}
                    title={
                      isMe
                        ? t('admin.cannotDeleteSelf')
                        : isAdminUser
                          ? t('admin.removeAdminRoleFirstTitle')
                          : undefined
                    }
                    onClick={() => deleteUser(u)}
                  >
                    {t('admin.deleteUser')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'artists' && (
        <div>
          {shownArtists.length === 0 && <p className="notice">{t('admin.noArtistsFound')}</p>}
          {shownArtists.map((a) => (
            <div className="panel" key={a.id} style={{ marginBottom: 12 }}>
              <div style={gridStyle}>
                <div className="field" style={{ margin: 0 }}>
                  <label>{t('admin.artistLabel')}</label>
                  <input
                    maxLength={80}
                    value={artistValue(a, 'name')}
                    onChange={(e) => setArtistField(a, 'name', e.target.value)}
                  />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>{t('dashboard.artists.bio')}</label>
                  <textarea
                    maxLength={500}
                    style={{ ...controlStyle, minHeight: 44, resize: 'vertical' }}
                    value={artistValue(a, 'bio')}
                    onChange={(e) => setArtistField(a, 'bio', e.target.value)}
                  />
                </div>
              </div>
              <div className="notice" style={{ marginTop: 8 }}>
                {t('admin.artistMeta', {
                  publisher: a.profiles?.display_name || t('admin.unknown'),
                  date: formatDate(a.created_at, lang),
                  releases: a.releases?.length ?? 0,
                  tracks: a.tracks?.[0]?.count ?? 0,
                })}{' '}
                <Link href={`/artist/${a.id}`}>{t('admin.viewPage')}</Link>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn"
                  type="button"
                  disabled={!artistDirty(a) || busy === a.id}
                  onClick={() => saveArtist(a)}
                >
                  {busy === a.id ? t('admin.working') : t('common.save')}
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={busy === a.id}
                  onClick={() => deleteArtist(a)}
                >
                  {t('admin.deleteArtist')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
