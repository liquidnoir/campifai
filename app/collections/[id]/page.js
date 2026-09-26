'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import JSZip from 'jszip'
import { supabase } from '../../../lib/supabase'
import { collectionTitle } from '../../../lib/collections'

// Hvor længe et afspilningslink er gyldigt (6 timer)
const SIGNED_URL_SECONDS = 60 * 60 * 6

function safeFileNamePart(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) || 'fil'
}

async function downloadReleaseZip(release, tracks, onProgress) {
  const zip = new JSZip()
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i]
    onProgress?.(i + 1, tracks.length)
    const res = await fetch(t.url)
    if (!res.ok) throw new Error(`Kunne ikke hente "${t.title}".`)
    const blob = await res.blob()
    const ext = (t.audio_path.split('.').pop() || 'audio').toLowerCase()
    const filename = `${String(i + 1).padStart(2, '0')} - ${safeFileNamePart(t.title)}.${ext}`
    zip.file(filename, blob)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeFileNamePart(release.title)}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function CollectionPage() {
  const { id } = useParams()
  const [session, setSession] = useState(undefined)
  const [collection, setCollection] = useState(null)
  const [releases, setReleases] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadState, setDownloadState] = useState({}) // { [releaseId]: { busy, progress, error } }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  useEffect(() => {
    if (id) load()
  }, [id])

  async function load() {
    const { data: collectionData } = await supabase.from('collections').select('*').eq('id', id).single()
    setCollection(collectionData)

    if (!collectionData) {
      setLoading(false)
      return
    }

    const { data: crData } = await supabase
      .from('collection_releases')
      .select('release_id, releases ( id, title, type, artist_id, artists ( name ), tracks ( count ) )')
      .eq('collection_id', id)
      .order('added_at', { ascending: true })
    setReleases((crData || []).map((r) => r.releases).filter(Boolean))
    setLoading(false)
  }

  async function handleDownload(release) {
    setDownloadState((prev) => ({ ...prev, [release.id]: { busy: true, progress: null, error: null } }))
    try {
      const { data: trackData, error: trackError } = await supabase
        .from('tracks')
        .select('id, title, audio_path')
        .eq('release_id', release.id)
        .order('created_at', { ascending: true })
      if (trackError) throw trackError
      const tracks = trackData || []
      if (tracks.length === 0) throw new Error('Denne udgivelse har ingen numre endnu.')

      const { data: signed, error: signError } = await supabase.storage
        .from('tracks')
        .createSignedUrls(tracks.map((t) => t.audio_path), SIGNED_URL_SECONDS)
      if (signError) throw signError
      const urlByPath = {}
      for (const s of signed || []) {
        if (s.signedUrl) urlByPath[s.path] = s.signedUrl
      }
      const withUrls = tracks.map((t) => ({ ...t, url: urlByPath[t.audio_path] }))
      if (withUrls.some((t) => !t.url)) throw new Error('Kunne ikke hente lydfilerne. Prøv igen.')

      await downloadReleaseZip(release, withUrls, (current, total) => {
        setDownloadState((prev) => ({ ...prev, [release.id]: { busy: true, progress: { current, total }, error: null } }))
      })
      setDownloadState((prev) => ({ ...prev, [release.id]: { busy: false, progress: null, error: null } }))
    } catch (err) {
      setDownloadState((prev) => ({
        ...prev,
        [release.id]: { busy: false, progress: null, error: err.message || 'Download fejlede. Prøv igen.' },
      }))
    }
  }

  if (loading) return <p className="notice">Henter...</p>
  if (!collection) return <p className="notice">Kollektionen findes ikke.</p>

  const canDownload = Boolean(session)

  return (
    <section>
      <h2>{collectionTitle(collection)}</h2>
      <p className="notice" style={{ marginTop: 8, marginBottom: 24 }}>
        {releases.length} {releases.length === 1 ? 'udgivelse' : 'udgivelser'} i denne kollektion.
      </p>

      {releases.length === 0 && <p className="notice">Ingen udgivelser i denne kollektion endnu.</p>}
      {releases.map((r) => {
        const state = downloadState[r.id] || {}
        return (
          <div className="track-row" key={r.id}>
            <div className="ttitle">
              <Link href={`/release/${r.id}`}>{r.title}</Link>
              <div className="notice">
                <Link href={`/artist/${r.artist_id}`}>{r.artists?.name || 'Ukendt kunstner'}</Link> ·{' '}
                {r.tracks?.[0]?.count ?? 0} numre
              </div>
              {state.error && <div className="error-msg">{state.error}</div>}
            </div>
            {canDownload ? (
              <button className="btn ghost" type="button" disabled={state.busy} onClick={() => handleDownload(r)}>
                {state.busy
                  ? state.progress
                    ? `Henter ${state.progress.current}/${state.progress.total}...`
                    : 'Forbereder...'
                  : 'Download (zip)'}
              </button>
            ) : (
              <Link href="/login" className="btn ghost">Log ind for at downloade</Link>
            )}
          </div>
        )
      })}
    </section>
  )
}
