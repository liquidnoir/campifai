'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { ROLE_LABELS, controlStyle, removeFolderFiles } from '../../lib/shared'

function Msg({ msg }) {
  if (!msg) return null
  if (msg.type === 'error') return <div className="error-msg">{msg.text}</div>
  return <div style={{ color: '#4B5A3E', fontSize: 14, marginBottom: 12 }}>{msg.text}</div>
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('da-DK') : ''
}

const gridStyle = {
  display: 'grid',
  gap: 10,
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
}

export default function AdminPage() {
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
      .select('id, name, bio, publisher_id, created_at, profiles ( display_name ), releases ( count ), tracks ( count )')
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
      setMsg({ type: 'error', text: 'Navnet må ikke være tomt.' })
      return
    }
    if (role !== u.role && role === 'admin') {
      if (!window.confirm(`Gør ${u.display_name} til admin? Admins har fuld adgang til alle brugere.`)) return
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
    setMsg({ type: 'ok', text: `${name} er opdateret.` })
    await loadUsers()
  }

  async function deleteUser(u) {
    setMsg(null)
    if (u.id === session.user.id) return
    if (u.role === 'admin') {
      setMsg({ type: 'error', text: 'Fjern først adminrollen, før du sletter en admin.' })
      return
    }
    const parts = [`Slet ${u.display_name} (${u.email})`]
    if (u.artist_count > 0) parts.push(`${u.artist_count} kunstnere`)
    if (u.release_count > 0) parts.push(`${u.release_count} udgivelser`)
    if (u.track_count > 0) parts.push(`${u.track_count} numre`)
    const question = parts.join(', ') + '? Det kan ikke fortrydes.'
    if (!window.confirm(question)) return
    setBusy(u.id)
    try {
      await removeFolderFiles(supabase, u.id)
      const { error } = await supabase.rpc('admin_delete_user', { target: u.id })
      if (error) throw error
      setMsg({ type: 'ok', text: `${u.display_name} er slettet.` })
      await Promise.all([loadUsers(), loadArtists()])
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Noget gik galt. Prøv igen.' })
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
      setMsg({ type: 'error', text: 'Navnet må ikke være tomt.' })
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
    setMsg({ type: 'ok', text: `${name} er opdateret.` })
    await loadArtists()
  }

  async function deleteArtist(a) {
    setMsg(null)
    const trackCount = a.tracks?.[0]?.count ?? 0
    const releaseCount = a.releases?.[0]?.count ?? 0
    const question =
      trackCount > 0
        ? `Slet ${a.name}, med ${releaseCount} udgivelser og ${trackCount} numre? Det kan ikke fortrydes.`
        : `Slet ${a.name}? Det kan ikke fortrydes.`
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
      const { error } = await supabase.from('artists').delete().eq('id', a.id)
      if (error) throw error
      setMsg({ type: 'ok', text: `${a.name} er slettet.` })
      await Promise.all([loadArtists(), loadUsers()])
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Noget gik galt. Prøv igen.' })
    }
    setBusy('')
  }

  if (session === undefined || !checked) return <p className="notice">Henter...</p>
  if (me?.role !== 'admin') {
    return (
      <section>
        <h2>Admin</h2>
        <p className="notice" style={{ marginTop: 12 }}>Du har ikke adgang til denne side.</p>
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
      <h2>Admin</h2>
      <p className="notice" style={{ marginTop: 8 }}>
        {countRole('listener')} lyttere · {countRole('publisher')} publishers · {countRole('admin')} admins ·{' '}
        {artists.length} kunstnere
      </p>

      <div style={{ display: 'flex', gap: 8, margin: '20px 0 12px' }}>
        <button className={tab === 'users' ? 'btn' : 'btn ghost'} onClick={() => setTab('users')}>
          Brugere ({users.length})
        </button>
        <button className={tab === 'artists' ? 'btn' : 'btn ghost'} onClick={() => setTab('artists')}>
          Kunstnere ({artists.length})
        </button>
      </div>

      <div className="field" style={{ maxWidth: 420 }}>
        <input
          placeholder={tab === 'users' ? 'Søg på navn eller email' : 'Søg på kunstner eller publisher'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Msg msg={msg} />

      {tab === 'users' && (
        <div>
          {shownUsers.length === 0 && <p className="notice">Ingen brugere fundet.</p>}
          {shownUsers.map((u) => {
            const isMe = u.id === session.user.id
            const isAdminUser = u.role === 'admin'
            return (
              <div className="panel" key={u.id} style={{ marginBottom: 12 }}>
                <div style={gridStyle}>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Navn{isMe ? ' (dig)' : ''}</label>
                    <input
                      maxLength={60}
                      value={userValue(u, 'display_name')}
                      onChange={(e) => setUserField(u, 'display_name', e.target.value)}
                    />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Rolle</label>
                    <select
                      style={controlStyle}
                      value={userValue(u, 'role')}
                      disabled={isMe}
                      onChange={(e) => setUserField(u, 'role', e.target.value)}
                    >
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="notice" style={{ marginTop: 8 }}>
                  {u.email} · oprettet {formatDate(u.created_at)} · {u.artist_count} kunstnere ·{' '}
                  {u.release_count} udgivelser · {u.track_count} numre
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button
                    className="btn"
                    type="button"
                    disabled={!userDirty(u) || busy === u.id}
                    onClick={() => saveUser(u)}
                  >
                    {busy === u.id ? 'Arbejder...' : 'Gem ændringer'}
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    disabled={isMe || isAdminUser || busy === u.id}
                    title={
                      isMe
                        ? 'Du kan ikke slette dig selv'
                        : isAdminUser
                          ? 'Fjern først adminrollen'
                          : undefined
                    }
                    onClick={() => deleteUser(u)}
                  >
                    Slet bruger
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'artists' && (
        <div>
          {shownArtists.length === 0 && <p className="notice">Ingen kunstnere fundet.</p>}
          {shownArtists.map((a) => (
            <div className="panel" key={a.id} style={{ marginBottom: 12 }}>
              <div style={gridStyle}>
                <div className="field" style={{ margin: 0 }}>
                  <label>Kunstner</label>
                  <input
                    maxLength={80}
                    value={artistValue(a, 'name')}
                    onChange={(e) => setArtistField(a, 'name', e.target.value)}
                  />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>Om kunstneren</label>
                  <textarea
                    maxLength={500}
                    style={{ ...controlStyle, minHeight: 44, resize: 'vertical' }}
                    value={artistValue(a, 'bio')}
                    onChange={(e) => setArtistField(a, 'bio', e.target.value)}
                  />
                </div>
              </div>
              <div className="notice" style={{ marginTop: 8 }}>
                Publisher: {a.profiles?.display_name || 'ukendt'} · oprettet {formatDate(a.created_at)} ·{' '}
                {a.releases?.[0]?.count ?? 0} udgivelser · {a.tracks?.[0]?.count ?? 0} numre ·{' '}
                <Link href={`/artist/${a.id}`}>Se side</Link>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn"
                  type="button"
                  disabled={!artistDirty(a) || busy === a.id}
                  onClick={() => saveArtist(a)}
                >
                  {busy === a.id ? 'Arbejder...' : 'Gem ændringer'}
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={busy === a.id}
                  onClick={() => deleteArtist(a)}
                >
                  Slet kunstner
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
