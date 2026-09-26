'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { collectionTitle } from '../../../../lib/collections'

export default function CollectionDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [session, setSession] = useState(undefined)
  const [me, setMe] = useState(null)
  const [checked, setChecked] = useState(false)
  const [collection, setCollection] = useState(null)
  const [rows, setRows] = useState([]) // { id (collection_releases.id), release }
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id])

  async function init() {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setMe(data || null)
    if (data?.role === 'admin') await load()
    setChecked(true)
  }

  async function load() {
    const { data: collectionData } = await supabase.from('collections').select('*').eq('id', id).single()
    setCollection(collectionData)

    const { data: crData } = await supabase
      .from('collection_releases')
      .select('id, release_id, releases ( id, title, type, artist_id, artists ( name ) )')
      .eq('collection_id', id)
      .order('added_at', { ascending: true })
    setRows((crData || []).filter((r) => r.releases))
  }

  async function runSearch(e) {
    e?.preventDefault()
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    setSearching(true)
    setMsg(null)

    const byTitleRes = await supabase
      .from('releases')
      .select('id, title, type, artist_id, artists ( name )')
      .ilike('title', `%${q}%`)
      .limit(25)

    if (byTitleRes.error) {
      setSearching(false)
      setMsg({ type: 'error', text: byTitleRes.error.message })
      return
    }

    // Kunstnernavn slås op i to trin (i stedet for et filter på et indlejret
    // felt, som er skrøbeligt) for at finde udgivelser via kunstnerens navn.
    const artistRes = await supabase.from('artists').select('id').ilike('name', `%${q}%`).limit(25)
    let byArtist = []
    if (artistRes.error) {
      setSearching(false)
      setMsg({ type: 'error', text: artistRes.error.message })
      return
    }
    if (artistRes.data && artistRes.data.length > 0) {
      const releasesByArtistRes = await supabase
        .from('releases')
        .select('id, title, type, artist_id, artists ( name )')
        .in('artist_id', artistRes.data.map((a) => a.id))
        .limit(25)
      if (releasesByArtistRes.error) {
        setSearching(false)
        setMsg({ type: 'error', text: releasesByArtistRes.error.message })
        return
      }
      byArtist = releasesByArtistRes.data || []
    }

    setSearching(false)
    const merged = [...(byTitleRes.data || []), ...byArtist]
    const byId = new Map(merged.map((r) => [r.id, r]))
    const combined = [...byId.values()]
    setResults(combined)
    if (combined.length === 0) {
      setMsg({ type: 'ok', text: `Ingen udgivelser matcher "${q}".` })
    }
  }

  async function addRelease(release) {
    setMsg(null)
    const { error } = await supabase
      .from('collection_releases')
      .insert({ collection_id: id, release_id: release.id })
    if (error) {
      setMsg({ type: 'error', text: error.code === '23505' ? 'Ligger allerede i kollektionen.' : error.message })
      return
    }
    load()
  }

  async function removeRow(row) {
    setBusy(row.id)
    const { error } = await supabase.from('collection_releases').delete().eq('id', row.id)
    setBusy('')
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    load()
  }

  async function toggleEnabled() {
    const { error } = await supabase
      .from('collections')
      .update({ enabled: !collection.enabled })
      .eq('id', id)
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
        <h2>Kollektion</h2>
        <p className="notice" style={{ marginTop: 12 }}>Du har ikke adgang til denne side.</p>
      </section>
    )
  }
  if (!collection) return <p className="notice">Kollektionen findes ikke.</p>

  const addedIds = new Set(rows.map((r) => r.release_id))

  return (
    <section>
      <div className="section-head">
        <h2>{collectionTitle(collection)}</h2>
        <button className="btn ghost" type="button" onClick={toggleEnabled}>
          {collection.enabled ? 'Deaktivér' : 'Aktivér'}
        </button>
      </div>
      <p className="notice" style={{ marginBottom: 20 }}>
        {collection.enabled ? 'Synlig for alle, når kataloget viser kollektioner.' : 'Skjult indtil den aktiveres.'}
      </p>

      <Msg msg={msg} />

      <div className="panel" style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Tilføj udgivelse</h3>
        <form onSubmit={runSearch} style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="Søg på titel eller kunstner"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn" type="submit" disabled={searching}>
            {searching ? '...' : 'Søg'}
          </button>
        </form>
        {results.length > 0 && (
          <div style={{ marginTop: 16 }}>
            {results.map((r) => {
              const already = addedIds.has(r.id)
              return (
                <div className="track-row" key={r.id}>
                  <div className="ttitle">
                    {r.title}
                    <div className="notice">{r.artists?.name || 'Ukendt kunstner'}</div>
                  </div>
                  <button className="btn ghost" type="button" disabled={already} onClick={() => addRelease(r)}>
                    {already ? 'Tilføjet' : 'Tilføj'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 8 }}>I kollektionen ({rows.length})</h3>
      {rows.length === 0 && <p className="notice">Ingen udgivelser tilføjet endnu.</p>}
      {rows.map((row) => (
        <div className="track-row" key={row.id}>
          <div className="ttitle">
            {row.releases.title}
            <div className="notice">{row.releases.artists?.name || 'Ukendt kunstner'}</div>
          </div>
          <button className="btn ghost" type="button" disabled={busy === row.id} onClick={() => removeRow(row)}>
            Fjern
          </button>
        </div>
      ))}
    </section>
  )
}

function Msg({ msg }) {
  if (!msg) return null
  if (msg.type === 'error') return <div className="error-msg">{msg.text}</div>
  return <div style={{ color: '#4B5A3E', fontSize: 14, marginBottom: 12 }}>{msg.text}</div>
}
