'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { imagePublicUrl } from '../../../lib/shared'
import { collectionTitle } from '../../../lib/collections'
import { hasReleaseAccess, hasCollectionAccess } from '../../../lib/purchases'
import { downloadCollectionZip } from '../../../lib/zipDownload'
import { useLanguage } from '../../../components/LanguageProvider'
import PurchaseGate from '../../../components/PurchaseGate'

// Hvor længe et afspilningslink er gyldigt (6 timer)
const SIGNED_URL_SECONDS = 60 * 60 * 6

function ReleaseCard({ release, access, canInteract, t }) {
  const coverUrl = imagePublicUrl(supabase, release.cover_path)
  return (
    <div>
      <Link href={`/release/${release.id}`} className="sleeve">
        <div
          className="cover"
          style={{
            background: coverUrl ? undefined : release.color || '#B8452B',
            backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {!coverUrl && <span className="title">{release.title}</span>}
        </div>
        <div className="meta">
          <div className="artist">{release.title}</div>
          <div className="sub">
            {release.artists?.name || t('home.unknownArtist')} ·{' '}
            {t('release.trackCount', { count: release.tracks?.[0]?.count ?? 0 })}
          </div>
        </div>
      </Link>
    </div>
  )
}

export default function CollectionPage() {
  const { t } = useLanguage()
  const { id } = useParams()
  const [session, setSession] = useState(undefined)
  const [isAdmin, setIsAdmin] = useState(false)
  const [collection, setCollection] = useState(null)
  const [releases, setReleases] = useState([])
  const [loading, setLoading] = useState(true)
  const [collectionAccess, setCollectionAccess] = useState(null) // null/true/false
  const [releaseAccess, setReleaseAccess] = useState({}) // { [releaseId]: true/false }
  const [downloadState, setDownloadState] = useState({}) // { [releaseId]: { busy, progress, error } }
  const [collectionDownload, setCollectionDownload] = useState({ busy: false, progress: null, error: null })

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
      .select(
        'release_id, releases ( id, title, type, color, cover_path, artist_id, publisher_id, artists ( name ), tracks ( count ) )'
      )
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

  async function handleDownloadCollection() {
    setCollectionDownload({ busy: true, progress: null, error: null })
    try {
      const releaseIds = releases.map((r) => r.id)
      const { data: trackData, error: trackError } = await supabase
        .from('tracks')
        .select('id, title, audio_path, release_id')
        .in('release_id', releaseIds)
        .order('created_at', { ascending: true })
      if (trackError) throw trackError
      const allTracks = trackData || []
      if (allTracks.length === 0) throw new Error(t('collectionPage.noTracksAtAll'))

      const { data: signed, error: signError } = await supabase.storage
        .from('tracks')
        .createSignedUrls(allTracks.map((tr) => tr.audio_path), SIGNED_URL_SECONDS)
      if (signError) throw signError
      const urlByPath = {}
      for (const s of signed || []) {
        if (s.signedUrl) urlByPath[s.path] = s.signedUrl
      }
      const withUrls = allTracks.map((tr) => ({ ...tr, url: urlByPath[tr.audio_path] }))
      if (withUrls.some((tr) => !tr.url)) throw new Error(t('collectionPage.couldNotFetchAudio'))

      const groups = releases.map((r) => ({
        title: r.title,
        tracks: withUrls.filter((tr) => tr.release_id === r.id),
      }))

      await downloadCollectionZip(
        collectionTitle(collection, t),
        groups,
        (current, total) => {
          setCollectionDownload({ busy: true, progress: { current, total }, error: null })
        },
        t
      )
      setCollectionDownload({ busy: false, progress: null, error: null })
    } catch (err) {
      setCollectionDownload({ busy: false, progress: null, error: err.message || t('release.downloadFailed') })
    }
  }

  if (loading) return <p className="notice">{t('common.loading')}</p>
  if (!collection) return <p className="notice">{t('collectionPage.notFound')}</p>

  const canInteract = Boolean(session)
  const coverUrl = imagePublicUrl(supabase, collection.cover_path)

  return (
    <section>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div
          className="cover"
          style={{
            width: 200,
            height: 200,
            flexShrink: 0,
            background: coverUrl ? undefined : '#B8452B',
            backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {!coverUrl && <span className="title">{collectionTitle(collection, t)}</span>}
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <h2>{collectionTitle(collection, t)}</h2>
          <p className="notice" style={{ marginTop: 8 }}>
            {t(releases.length === 1 ? 'collectionPage.releaseCount_one' : 'collectionPage.releaseCount_other', {
              count: releases.length,
            })}
          </p>

          {canInteract && (
            <div style={{ marginTop: 16 }}>
              <PurchaseGate
                scope="collection"
                collectionId={collection.id}
                itemLabel={t('collectionPage.wholeCollection')}
                hasAccess={collectionAccess}
                onGranted={checkAllAccess}
              />
              {collectionAccess === true && (
                <div>
                  <p className="notice" style={{ marginBottom: 12 }}>{t('collectionPage.hasAccess')}</p>
                  <button
                    className="btn"
                    type="button"
                    disabled={collectionDownload.busy}
                    onClick={handleDownloadCollection}
                  >
                    {collectionDownload.busy
                      ? collectionDownload.progress
                        ? t('common.fetching', { current: collectionDownload.progress.current, total: collectionDownload.progress.total })
                        : t('common.preparing')
                      : t('collectionPage.downloadWhole')}
                  </button>
                  {collectionDownload.error && <div className="error-msg">{collectionDownload.error}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        {releases.length === 0 && <p className="notice">{t('collectionPage.empty')}</p>}
        <div className="grid">
          {releases.map((r) => {
            const state = downloadState[r.id] || {}
            const access = releaseAccess[r.id]
            return (
              <div key={r.id}>
                <ReleaseCard release={r} access={access} canInteract={canInteract} t={t} />
                <div style={{ marginTop: 8 }}>
                  {!canInteract ? (
                    <Link href="/login" className="btn ghost" style={{ display: 'block', textAlign: 'center' }}>
                      {t('nav.login')}
                    </Link>
                  ) : access ? (
                    <Link href={`/release/${r.id}`} className="btn ghost" style={{ display: 'block', textAlign: 'center' }}>
                      {t('common.download')}
                    </Link>
                  ) : (
                    <Link href={`/release/${r.id}`} className="btn ghost" style={{ display: 'block', textAlign: 'center' }}>
                      {t('collectionPage.buyThisRelease')}
                    </Link>
                  )}
                  {state.error && <div className="error-msg">{state.error}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
