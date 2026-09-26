'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { controlStyle } from '../../../lib/shared'
import { SEASON_LABELS, SEASON_ORDER, collectionTitle } from '../../../lib/collections'

function Msg({ msg }) {
  if (!msg) return null
  if (msg.type === 'error') return <div className="error-msg">{msg.text}</div>
  return <div style={{ color: '#4B5A3E', fontSize: 14, marginBottom: 12 }}>{msg.text}</div>
}

const currentYear = new Date().getFullYear()

export default function CollectionsAdminPage() {
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
  const [creating, setCreating] = useState(false)

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
      .select('id, season, year, title, enabled, created_at, collection_releases ( count )')
      .order('year', { ascending: false })
      .order('season', { ascending: true })
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    setCollections(data || [])
  }

  async function createCollection(e) {
    e.preventDefault()
    setMsg(null)
    setCreating(true)
    const { error } = await supabase.from('collections').insert({
      season: newSeason,
      year: Number(newYear),
      title: newTitle.trim() || null,
    })
    setCreating(false)
    if (error) {
      setMsg({
        type: 'error',
        text: error.code === '23505' ? 'Den sæson/år findes allerede.' : error.message,
      })
      return
    }
    setNewTitle('')
    load()
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
    if (!window.confirm(`Slet kollektionen "${collectionTitle(c)}"? Det kan ikke fortrydes.`)) return
    setBusy(c.id)
    const { error } = await supabase.from('collections').delete().eq('id', c.id)
    setBusy('')
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    load()
  }

  if (session === undefined || !checked) return <p className="notice">Henter...</p>
  if (me?.role !== 'admin') {
    return (
      <section>
        <h2>Kollektioner</h2>
        <p className="notice" style={{ marginTop: 12 }}>Du har ikke adgang til denne side.</p>
      </section>
    )
  }

  return (
    <section>
      <h2>Kollektioner</h2>
      <p className="notice" style={{ marginTop: 8 }}>
        Fire årlige kollektioner — Forår, Sommer, Efterår, Vinter — sammensat af udvalgte udgivelser.
      </p>

      <div className="panel" style={{ maxWidth: 480, marginTop: 20, marginBottom: 28 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Opret ny kollektion</h3>
        <form onSubmit={createCollection}>
          <div className="field">
            <label>Sæson</label>
            <select style={controlStyle} value={newSeason} onChange={(e) => setNewSeason(e.target.value)}>
              {SEASON_ORDER.map((s) => (
                <option key={s} value={s}>{SEASON_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>År</label>
            <input
              type="number"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              style={controlStyle}
            />
          </div>
          <div className="field">
            <label>Eget navn (valgfrit)</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={`Standard: ${SEASON_LABELS[newSeason]} ${newYear}`}
            />
          </div>
          <Msg msg={msg} />
          <button className="btn" type="submit" disabled={creating}>
            {creating ? 'Opretter...' : 'Opret kollektion'}
          </button>
        </form>
      </div>

      {collections.length === 0 && <p className="notice">Ingen kollektioner oprettet endnu.</p>}
      {collections.map((c) => (
        <div className="track-row" key={c.id}>
          <div className="ttitle">
            <Link href={`/admin/collections/${c.id}`}>{collectionTitle(c)}</Link>
            <div className="notice">
              {c.enabled ? 'Aktiveret' : 'Deaktiveret'} · {c.collection_releases?.[0]?.count ?? 0} udgivelser
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" type="button" disabled={busy === c.id} onClick={() => toggleEnabled(c)}>
              {c.enabled ? 'Deaktivér' : 'Aktivér'}
            </button>
            <button className="btn ghost" type="button" disabled={busy === c.id} onClick={() => deleteCollection(c)}>
              Slet
            </button>
          </div>
        </div>
      ))}
    </section>
  )
}
