'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { MAX_IMAGE_MB, controlStyle, imagePublicUrl, removeFolderFiles, removeFolderImages, removeImage, uploadImage } from '../../lib/shared'
import { useLanguage } from '../../components/LanguageProvider'
import { useConfirm } from '../../components/ConfirmProvider'

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
  const confirm = useConfirm()
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
  const [settings, setSettings] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [heroForm, setHeroForm] = useState({ titleDa: '', titleEn: '', bodyDa: '', bodyEn: '' })
  const [savingHeroText, setSavingHeroText] = useState(false)
  const [heroTextMsg, setHeroTextMsg] = useState(null)
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false)
  const [heroImageMsg, setHeroImageMsg] = useState(null)

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
      await Promise.all([loadUsers(), loadArtists(), loadSettings()])
    }
    setChecked(true)
  }

  async function loadSettings() {
    const { data, error } = await supabase
      .from('app_settings')
      .select('purchases_enabled, donations_enabled, hero_image_path, hero_title_da, hero_title_en, hero_body_da, hero_body_en')
      .eq('id', 1)
      .maybeSingle()
    if (!error && data) {
      setSettings(data)
      setHeroForm({
        titleDa: data.hero_title_da || '',
        titleEn: data.hero_title_en || '',
        bodyDa: data.hero_body_da || '',
        bodyEn: data.hero_body_en || '',
      })
    }
  }

  async function toggleSetting(field) {
    if (!settings) return
    setSavingSettings(true)
    const next = { ...settings, [field]: !settings[field] }
    const { error } = await supabase
      .from('app_settings')
      .update({ [field]: next[field] })
      .eq('id', 1)
    setSavingSettings(false)
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    setSettings(next)
  }

  async function saveHeroText(e) {
    e.preventDefault()
    setHeroTextMsg(null)
    setSavingHeroText(true)
    const changes = {
      hero_title_da: heroForm.titleDa.trim() || null,
      hero_title_en: heroForm.titleEn.trim() || null,
      hero_body_da: heroForm.bodyDa.trim() || null,
      hero_body_en: heroForm.bodyEn.trim() || null,
    }
    const { error } = await supabase.from('app_settings').update(changes).eq('id', 1)
    setSavingHeroText(false)
    if (error) {
      setHeroTextMsg({ type: 'error', text: error.message })
      return
    }
    setSettings((prev) => ({ ...prev, ...changes }))
    setHeroTextMsg({ type: 'ok', text: t('admin.hero.saved') })
  }

  async function resetHeroText() {
    setHeroTextMsg(null)
    setSavingHeroText(true)
    const changes = { hero_title_da: null, hero_title_en: null, hero_body_da: null, hero_body_en: null }
    const { error } = await supabase.from('app_settings').update(changes).eq('id', 1)
    setSavingHeroText(false)
    if (error) {
      setHeroTextMsg({ type: 'error', text: error.message })
      return
    }
    setSettings((prev) => ({ ...prev, ...changes }))
    setHeroForm({ titleDa: '', titleEn: '', bodyDa: '', bodyEn: '' })
    setHeroTextMsg({ type: 'ok', text: t('admin.hero.resetDone') })
  }

  async function handleHeroImageChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setHeroImageMsg(null)
    setUploadingHeroImage(true)
    try {
      const path = await uploadImage(supabase, session.user.id, 'hero', file, t)
      const { error } = await supabase.from('app_settings').update({ hero_image_path: path }).eq('id', 1)
      if (error) throw error
      if (settings?.hero_image_path) await removeImage(supabase, settings.hero_image_path)
      setSettings((prev) => ({ ...prev, hero_image_path: path }))
      setHeroImageMsg({ type: 'ok', text: t('admin.hero.imageSaved') })
    } catch (err) {
      setHeroImageMsg({ type: 'error', text: err.message || t('common.somethingWrong') })
    }
    setUploadingHeroImage(false)
    e.target.value = ''
  }

  async function resetHeroImage() {
    setHeroImageMsg(null)
    setUploadingHeroImage(true)
    const { error } = await supabase.from('app_settings').update({ hero_image_path: null }).eq('id', 1)
    if (!error && settings?.hero_image_path) await removeImage(supabase, settings.hero_image_path)
    setUploadingHeroImage(false)
    if (error) {
      setHeroImageMsg({ type: 'error', text: error.message })
      return
    }
    setSettings((prev) => ({ ...prev, hero_image_path: null }))
    setHeroImageMsg({ type: 'ok', text: t('admin.hero.resetDone') })
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
      if (!(await confirm(t('admin.confirmMakeAdmin', { name: u.display_name })))) return
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

  async function approvePublisher(u) {
    setMsg(null)
    setBusy(u.id)
    // Rollen ændres; databasen rydder selv anmodningen, når rollen bliver publisher
    const { error } = await supabase.from('profiles').update({ role: 'publisher' }).eq('id', u.id)
    setBusy('')
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    setMsg({ type: 'ok', text: t('admin.publisherApproved', { name: u.display_name }) })
    await loadUsers()
  }

  async function rejectPublisher(u) {
    setMsg(null)
    setBusy(u.id)
    const { error } = await supabase.from('profiles').update({ publisher_requested: false }).eq('id', u.id)
    setBusy('')
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    setMsg({ type: 'ok', text: t('admin.publisherRejected', { name: u.display_name }) })
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
    if (!(await confirm(question, { label: t('common.delete'), danger: true }))) return
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
    if (!(await confirm(question, { label: t('common.delete'), danger: true }))) return
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
  const isPending = (u) => u.publisher_requested && u.role === 'listener'
  const pendingCount = users.filter(isPending).length
  const shownUsers = users
    .filter(
      (u) =>
        !q ||
        u.display_name.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    )
    .sort((a, b) => Number(isPending(b)) - Number(isPending(a)))
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

      {pendingCount > 0 && (
        <p className="notice" style={{ marginTop: 12, color: '#D89A2E' }}>
          {t('admin.pendingBanner', { count: pendingCount })}
        </p>
      )}

      {settings && (
        <div className="panel" style={{ maxWidth: 420, marginTop: 16, marginBottom: 8 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>{t('admin.settings.title')}</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={settings.purchases_enabled}
              disabled={savingSettings}
              onChange={() => toggleSetting('purchases_enabled')}
            />
            {t('admin.settings.purchases')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={settings.donations_enabled}
              disabled={savingSettings}
              onChange={() => toggleSetting('donations_enabled')}
            />
            {t('admin.settings.donations')}
          </label>
        </div>
      )}

      {settings && (
        <div className="panel" style={{ maxWidth: 480, marginBottom: 8 }}>
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>{t('admin.hero.title')}</h3>
          <p className="notice" style={{ marginBottom: 14 }}>{t('admin.hero.hint')}</p>

          <div className="field">
            <label>{t('admin.hero.imageLabel')}</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {settings.hero_image_path && (
                <div
                  style={{
                    width: 64,
                    height: 44,
                    borderRadius: 6,
                    flexShrink: 0,
                    backgroundImage: `url(${imagePublicUrl(supabase, settings.hero_image_path)})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
              )}
              <input type="file" accept="image/*" disabled={uploadingHeroImage} onChange={handleHeroImageChange} />
            </div>
            <div className="notice" style={{ marginTop: 4 }}>
              {t('dashboard.imagePicker.hint', { max: MAX_IMAGE_MB })}
            </div>
          </div>
          {settings.hero_image_path && (
            <button className="btn ghost" type="button" disabled={uploadingHeroImage} onClick={resetHeroImage}>
              {t('admin.hero.resetImage')}
            </button>
          )}
          <Msg msg={heroImageMsg} />

          <form onSubmit={saveHeroText} style={{ marginTop: 20 }}>
            <div className="field">
              <label>{t('admin.hero.titleDa')}</label>
              <input
                value={heroForm.titleDa}
                onChange={(e) => setHeroForm((f) => ({ ...f, titleDa: e.target.value }))}
                placeholder={t('home.hero.title')}
              />
            </div>
            <div className="field">
              <label>{t('admin.hero.bodyDa')}</label>
              <textarea
                value={heroForm.bodyDa}
                onChange={(e) => setHeroForm((f) => ({ ...f, bodyDa: e.target.value }))}
                placeholder={t('home.hero.body')}
                style={{ ...controlStyle, minHeight: 72, resize: 'vertical' }}
              />
            </div>
            <div className="field">
              <label>{t('admin.hero.titleEn')}</label>
              <input
                value={heroForm.titleEn}
                onChange={(e) => setHeroForm((f) => ({ ...f, titleEn: e.target.value }))}
                placeholder={t('home.hero.title')}
              />
            </div>
            <div className="field">
              <label>{t('admin.hero.bodyEn')}</label>
              <textarea
                value={heroForm.bodyEn}
                onChange={(e) => setHeroForm((f) => ({ ...f, bodyEn: e.target.value }))}
                placeholder={t('home.hero.body')}
                style={{ ...controlStyle, minHeight: 72, resize: 'vertical' }}
              />
            </div>
            <Msg msg={heroTextMsg} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" type="submit" disabled={savingHeroText}>
                {savingHeroText ? t('common.saving') : t('common.save')}
              </button>
              <button className="btn ghost" type="button" disabled={savingHeroText} onClick={resetHeroText}>
                {t('admin.hero.resetText')}
              </button>
            </div>
          </form>
        </div>
      )}

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
        <Link href="/admin/releases" className="btn ghost">
          {t('admin.releasesLink')}
        </Link>
        <Link href="/admin/statistik" className="btn ghost">
          {t('admin.statsLink')}
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
                {isPending(u) && (
                  <div style={{ marginBottom: 12 }}>
                    <p className="notice" style={{ marginBottom: 8, color: '#D89A2E' }}>
                      {t('admin.publisherPending')}
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn" type="button" disabled={busy === u.id} onClick={() => approvePublisher(u)}>
                        {t('admin.approvePublisher')}
                      </button>
                      <button className="btn ghost" type="button" disabled={busy === u.id} onClick={() => rejectPublisher(u)}>
                        {t('admin.rejectPublisher')}
                      </button>
                    </div>
                  </div>
                )}
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
