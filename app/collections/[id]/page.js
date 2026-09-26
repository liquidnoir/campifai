'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { collectionTitle } from '../../../lib/collections'
import { hasReleaseAccess, hasCollectionAccess } from '../../../lib/purchases'
import { downloadReleaseZip } from '../../../lib/zipDownload'
import PurchaseGate from '../../../components/PurchaseGate'

// Hvor længe et afspilningslink er gyldigt (6 timer)
const SIGNED_URL_SECONDS = 60 * 60 * 6

export default function CollectionPage() {
  const { id } = useParams()
  const [session, setSession] = useState(undefined)
  const [isAdmin, setIsAdmin] = useState(false)
  const [collection, setCollection] = useState(null)
  const [releases, setReleases] = useState([])
  const [loading, setLoading] = useState(true)
  const [collectionAccess, setCollectionAccess] = useState(null) // null/true/false
  const [releaseAccess, setReleaseAccess] = useState({}) // { [releaseId]: true/false }
  const [downloadState, setDownloadState] = useState({}) // { [releaseId]: { busy, progress, error } }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  useEffect(() => {
    if (id) load()
  }, [id])

  useEffect(() => {
    if (session === undefined || releases.length === 0) return
    checkAllAccess()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, releases])

  async function load() {
    const { data: collectionData } = await supabase.from('collections').select('*').eq('id', id).single()
    setCollection(collectionData)

    if (!collectionData) {
      setLoading(false)
      return
    }

    const { data: crData } = await supabase
      .from('collection_releases')
      .select('release_id, releases ( id, title, type, artist_id, publisher_id, artists ( name ), tracks ( count ) )')
      .eq('collection_id', id)
      .order('added_at', { ascending: true })
    setReleases((crData || []).map((r) => r.releases).filter(Boolean))
    setLoading(false)
  }

  async function checkAllAccess() {
    if (!session) {
      setCollectionAccess(false)
      setReleaseAccess(Object.fromEntries(releases.map((r) => [r.id, false])))
      return
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    const admin = profile?.role === 'admin'
    setIsAdmin(admin)

    const collAccess = await hasCollectionAccess(supabase, { userId: session.user.id, isAdmin: admin, collectionId: id })
    setCollectionAccess(collAccess)

    const entries = await Promise.all(
      releases.map(async (r) => [
        r.id,
        await hasReleaseAccess(supabase, { userId: session.user.id, isAdmin: admin, release: r }),
      ])
    )
    setReleaseAccess(Object.fromEntries(entries))
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

  const canInteract = Boolean(session)

  return (
    <section>
      <h2>{collectionTitle(collection)}</h2>
      <p className="notice" style={{ marginTop: 8, marginBottom: 24 }}>
        {releases.length} {releases.length === 1 ? 'udgivelse' : 'udgivelser'} i denne kollektion.
      </p>

      {canInteract && (
        <PurchaseGate
          scope="collection"
          collectionId={collection.id}
          itemLabel="hele kollektionen"
          hasAccess={collectionAccess}
          onGranted={checkAllAccess}
        />
      )}
      {collectionAccess === true && (
        <p className="notice" style={{ marginBottom: 20 }}>
          Du har adgang til hele kollektionen — download de enkelte udgivelser nedenfor.
        </p>
      )}

      {releases.length === 0 && <p className="notice">Ingen udgivelser i denne kollektion endnu.</p>}
      {releases.map((r) => {
        const state = downloadState[r.id] || {}
        const access = releaseAccess[r.id]
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
            {!canInteract ? (
              <Link href="/login" className="btn ghost">Log ind</Link>
            ) : access ? (
              <button className="btn ghost" type="button" disabled={state.busy} onClick={() => handleDownload(r)}>
                {state.busy
                  ? state.progress
                    ? `Henter ${state.progress.current}/${state.progress.total}...`
                    : 'Forbereder...'
                  : 'Download (zip)'}
              </button>
            ) : (
              <Link href={`/release/${r.id}`} className="btn ghost">Køb denne udgivelse</Link>
            )}
          </div>
        )
      })}
    </section>
  )
}
