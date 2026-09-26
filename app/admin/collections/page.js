'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { MAX_IMAGE_MB, controlStyle, imagePublicUrl, removeImage, uploadImage } from '../../../lib/shared'
import { SEASON_ORDER, collectionTitle } from '../../../lib/collections'
import { useLanguage } from '../../../components/LanguageProvider'

function Msg({ msg }) {
  if (!msg) return null
  if (msg.type === 'error') return <div className="error-msg">{msg.text}</div>
  return <div style={{ color: '#4B5A3E', fontSize: 14, marginBottom: 12 }}>{msg.text}</div>
}

function ImagePicker({ label, currentUrl, onChange, disabled, hint }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {currentUrl && (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              backgroundImage: `url(${currentUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              flexShrink: 0,
            }}
          />
        )}
        <input type="file" accept="image/*" disabled={disabled} onChange={onChange} />
      </div>
      <div className="notice" style={{ marginTop: 4 }}>{hint}</div>
    </div>
  )
}

function Thumb({ url, radius = 8 }) {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: radius,
        flexShrink: 0,
        background: url ? undefined : '#B8452B',
        backgroundImage: url ? `url(${url})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
  )
}

const currentYear = new Date().getFullYear()

export default function CollectionsAdminPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [session, setSession] = useState(undefined)
  const [me, setMe] = useState(null)
  const [checked, setChecked] = useState(false)
  const [collections, setCollections] = useState([])
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState('')

  const [newSeason, setNewSeason] = useState('spring')
  const [newYear, setNewYear] = useState(currentYear)
  const [newTitle, setNewTitle] = useState('')
  const [newImage, setNewImage] = useState(null)
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editSeason, setEditSeason] = useState('spring')
  const [editYear, setEditYear] = useState(currentYear)
  const [editTitle, setEditTitle] = useState('')
  const [editImage, setEditImage] = useState(null)
  const [saving, setSaving] = useState(false)

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
    if (data?.role === 'admin') await load()
    setChecked(true)
  }

  async function load() {
    const { data, error } = await supabase
      .from('collections')
      .select('id, season, year, title, enabled, cover_path, created_at, collection_releases ( count )')
      .order('year', { ascending: false })
      .order('season', { ascending: true })
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    setCollections(data || [])
  }

  function pickImage(setter) {
    return (e) => {
      const chosen = e.target.files[0] || null
      if (chosen && !chosen.type.startsWith('image/')) {
        e.target.value = ''
        setter(null)
        return
      }
      setter(chosen)
    }
  }

  async function createCollection(e) {
    e.preventDefault()
    setMsg(null)
    setCreating(true)
    try {
      const { data: created, error } = await supabase
        .from('collections')
        .insert({
          season: newSeason,
          year: Number(newYear),
          title: newTitle.trim() || null,
        })
        .select()
        .single()
      if (error) throw error

      if (newImage) {
        const path = await uploadImage(supabase, session.user.id, 'collection', newImage, t)
        const { error: updateError } = await supabase.from('collections').update({ cover_path: path }).eq('id', created.id)
        if (updateError) throw updateError
      }

      setNewTitle('')
      setNewImage(null)
      load()
    } catch (err) {
      setMsg({ type: 'error', text: err.code === '23505' ? t('adminCollections.duplicate') : err.message })
    }
    setCreating(false)
  }

  function startEdit(c) {
    setMsg(null)
    setEditingId(c.id)
    setEditSeason(c.season)
    setEditYear(c.year)
    setEditTitle(c.title || '')
    setEditImage(null)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(c) {
    setMsg(null)
    setSaving(true)
    try {
      const changes = {
        season: editSeason,
        year: Number(editYear),
        title: editTitle.trim() || null,
      }
      if (editImage) {
        const path = await uploadImage(supabase, session.user.id, 'collection', editImage, t)
        changes.cover_path = path
      }
      const { error } = await supabase.from('collections').update(changes).eq('id', c.id)
      if (error) throw error
      if (editImage && c.cover_path) {
        await removeImage(supabase, c.cover_path)
      }
      setEditingId(null)
      load()
    } catch (err) {
      setMsg({ type: 'error', text: err.code === '23505' ? t('adminCollections.duplicateOther') : err.message })
    }
    setSaving(false)
  }

  async function toggleEnabled(c) {
    setBusy(c.id)
    const { error } = await supabase.from('collections').update({ enabled: !c.enabled }).eq('id', c.id)
    setBusy('')
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    load()
  }

  async function deleteCollection(c) {
    if (!window.confirm(t('adminCollections.deleteConfirm', { title: collectionTitle(c, t) }))) return
    setBusy(c.id)
    try {
      if (c.cover_path) {
        await removeImage(supabase, c.cover_path)
      }
      const { error } = await supabase.from('collections').delete().eq('id', c.id)
      if (error) throw error
      load()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
    setBusy('')
  }

  if (session === undefined || !checked) return <p className="notice">{t('common.loading')}</p>
  if (me?.role !== 'admin') {
    return (
      <section>
        <h2>{t('adminCollections.title')}</h2>
        <p className="notice" style={{ marginTop: 12 }}>{t('admin.noAccess')}</p>
      </section>
    )
  }

  return (
    <section>
      <h2>{t('adminCollections.title')}</h2>
      <p className="notice" style={{ marginTop: 8 }}>{t('adminCollections.intro')}</p>

      <div className="panel" style={{ maxWidth: 480, marginTop: 20, marginBottom: 28 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>{t('adminCollections.createTitle')}</h3>
        <form onSubmit={createCollection}>
          <div className="field">
            <label>{t('adminCollections.season')}</label>
            <select style={controlStyle} value={newSeason} onChange={(e) => setNewSeason(e.target.value)}>
              {SEASON_ORDER.map((s) => (
                <option key={s} value={s}>{t(`season.${s}`)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t('adminCollections.year')}</label>
            <input
              type="number"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              style={controlStyle}
            />
          </div>
          <div className="field">
            <label>{t('adminCollections.ownTitle')}</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t('adminCollections.ownTitlePlaceholder', { season: t(`season.${newSeason}`), year: newYear })}
            />
          </div>
          <ImagePicker
            label={t('dashboard.coverArtLabel')}
            currentUrl={null}
            onChange={pickImage(setNewImage)}
            hint={t('dashboard.imagePicker.hint', { max: MAX_IMAGE_MB })}
          />
          <Msg msg={msg} />
          <button className="btn" type="submit" disabled={creating}>
            {creating ? t('common.saving') : t('adminCollections.createButton')}
          </button>
        </form>
      </div>

      {collections.length === 0 && <p className="notice">{t('adminCollections.empty')}</p>}
      {collections.map((c) =>
        editingId === c.id ? (
          <div className="panel" key={c.id} style={{ maxWidth: 480, marginBottom: 16 }}>
            <div className="field">
              <label>{t('adminCollections.season')}</label>
              <select style={controlStyle} value={editSeason} onChange={(e) => setEditSeason(e.target.value)}>
                {SEASON_ORDER.map((s) => (
                  <option key={s} value={s}>{t(`season.${s}`)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('adminCollections.year')}</label>
              <input type="number" value={editYear} onChange={(e) => setEditYear(e.target.value)} style={controlStyle} />
            </div>
            <div className="field">
              <label>{t('adminCollections.ownTitle')}</label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder={t('adminCollections.ownTitlePlaceholder', { season: t(`season.${editSeason}`), year: editYear })}
              />
            </div>
            <ImagePicker
              label={t('dashboard.coverArtLabel')}
              currentUrl={imagePublicUrl(supabase, c.cover_path)}
              onChange={pickImage(setEditImage)}
              disabled={saving}
              hint={t('dashboard.imagePicker.hint', { max: MAX_IMAGE_MB })}
            />
            <Msg msg={msg} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" type="button" disabled={saving} onClick={() => saveEdit(c)}>
                {saving ? t('common.saving') : t('common.save')}
              </button>
              <button className="btn ghost" type="button" onClick={cancelEdit}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="track-row" key={c.id}>
            <div className="ttitle" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Thumb url={imagePublicUrl(supabase, c.cover_path)} />
              <div>
                <Link href={`/admin/collections/${c.id}`}>{collectionTitle(c, t)}</Link>
                <div className="notice">
                  {c.enabled ? t('adminCollections.enabled') : t('adminCollections.disabled')} ·{' '}
                  {t('home.collections.releaseCount', { count: c.collection_releases?.[0]?.count ?? 0 })}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost" type="button" onClick={() => startEdit(c)}>
                {t('common.edit')}
              </button>
              <button className="btn ghost" type="button" disabled={busy === c.id} onClick={() => toggleEnabled(c)}>
                {c.enabled ? t('adminCollections.disable') : t('adminCollections.enable')}
              </button>
              <button className="btn ghost" type="button" disabled={busy === c.id} onClick={() => deleteCollection(c)}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        )
      )}
    </section>
  )
}
