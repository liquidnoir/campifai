'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { RELEASE_TYPE_LABELS, imagePublicUrl } from '../../../lib/shared'
import { hasReleaseAccess } from '../../../lib/purchases'
import { downloadReleaseZip } from '../../../lib/zipDownload'
import ShareButton from '../../../components/ShareButton'
import AddToPlaylistButton from '../../../components/AddToPlaylistButton'
import QueuePlayer from '../../../components/QueuePlayer'
import PurchaseGate from '../../../components/PurchaseGate'

// Hvor længe et afspilningslink er gyldigt (6 timer)
const SIGNED_URL_SECONDS = 60 * 60 * 6

function ReleaseContent() {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('t')
  const [session, setSession] = useState(undefined)
  const [release, setRelease] = useState(null)
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(null) // null = tjekker, true/false = kendt
  const [download, setDownload] = useState({ busy: false, progress: null, error: null })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  useEffect(() => {
    if (id) loadRelease()
  }, [id])

  useEffect(() => {
    if (session === undefined || !release) return
    checkAccess()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, release])

  async function loadRelease() {
    const { data: releaseData } = await supabase
      .from('releases')
      .select(
        'id, title, type, color, cover_path, genre, artist_id, publisher_id, artists ( name ), profiles ( display_name )'
      )
      .eq('id', id)
      .single()
    setRelease(releaseData)

    if (!releaseData) {
      setLoading(false)
      return
    }

    const { data: trackData } = await supabase
      .from('tracks')
      .select('*')
      .eq('release_id', id)
      .order('created_at', { ascending: true })
    const trackList = trackData || []

    // Bucketten er privat, så vi henter midlertidige links til lydfilerne.
    // Anonyme besøgende har ikke adgang, og linkene bliver blot tomme for dem.
    const urlByPath = {}
    if (trackList.length > 0) {
      const { data: signed } = await supabase.storage
        .from('tracks')
        .createSignedUrls(trackList.map((t) => t.audio_path), SIGNED_URL_SECONDS)
      for (const s of signed || []) {
        if (s.signedUrl) urlByPath[s.path] = s.signedUrl
      }
    }

    setTracks(trackList.map((t) => ({ ...t, url: urlByPath[t.audio_path] || null })))
    setLoading(false)
  }

  async function checkAccess() {
    if (!session) {
      setHasAccess(false)
      return
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    const admin = profile?.role === 'admin'
    const access = await hasReleaseAccess(supabase, { userId: session.user.id, isAdmin: admin, release })
    setHasAccess(access)
  }

  async function handleTrackStart(t) {
    try {
      await supabase.rpc('increment_play_count', { track_id: t.id })
    } catch {
      // Tæller-opdateringen fejlede stille — påvirker ikke afspilningen
    }
  }

  async function handleDownload() {
    setDownload({ busy: true, progress: null, error: null })
    try {
      const playable = tracks.filter((t) => t.url)
      if (playable.length === 0) throw new Error('Ingen numre at downloade.')
      await downloadReleaseZip(release, playable, (current, total) => {
        setDownload({ busy: true, progress: { current, total }, error: null })
      })
      setDownload({ busy: false, progress: null, error: null })
    } catch (err) {
      setDownload({ busy: false, progress: null, error: err.message || 'Download fejlede. Prøv igen.' })
    }
  }

  if (loading) return <p className="notice">Henter...</p>
  if (!release) return <p className="notice">Udgivelse ikke fundet.</p>

  const coverUrl = imagePublicUrl(supabase, release.cover_path)
  const publisherName = release.profiles?.display_name
  const artistName = release.artists?.name
  const showPublisher = publisherName && publisherName.trim().toLowerCase() !== (artistName || '').trim().toLowerCase()
  const canInteract = Boolean(session)

  const startIndex = Math.max(
    0,
    tracks.findIndex((t) => t.id === highlightId)
  )

  return (
    <section>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div
          className="cover"
          style={{
            width: 200,
            height: 200,
            flexShrink: 0,
            background: coverUrl ? undefined : release.color || '#B8452B',
            backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {!coverUrl && <span className="title">{release.title}</span>}
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div>
              <div className="notice">
                {RELEASE_TYPE_LABELS[release.type] || release.type}
                {release.genre ? ` · ${release.genre}` : ''}
              </div>
              <h2 style={{ marginTop: 4 }}>{release.title}</h2>
              <p className="notice" style={{ marginTop: 4 }}>
                <Link href={`/artist/${release.artist_id}`}>{artistName || 'Ukendt kunstner'}</Link>
                {showPublisher && <> · Udgivet af {publisherName}</>}
              </p>
            </div>
            <ShareButton
              path={`/release/${release.id}`}
              title={`${release.title} — ${artistName || ''}`}
              label="Del udgivelse"
            />
          </div>
        </div>
      </div>

      {canInteract && (
        <div style={{ marginTop: 20 }}>
          <PurchaseGate
            scope="release"
            releaseId={release.id}
            itemLabel={`"${release.title}"`}
            hasAccess={hasAccess}
            onGranted={checkAccess}
          />
          {hasAccess === true && (
            <div style={{ marginBottom: 20 }}>
              <button className="btn ghost" type="button" disabled={download.busy} onClick={handleDownload}>
                {download.busy
                  ? download.progress
                    ? `Henter ${download.progress.current}/${download.progress.total}...`
                    : 'Forbereder...'
                  : 'Download (zip)'}
              </button>
              {download.error && <div className="error-msg">{download.error}</div>}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        {tracks.length === 0 && <p className="notice">Ingen numre i denne udgivelse endnu.</p>}
        {tracks.length > 0 && canInteract && (
          <QueuePlayer
            tracks={tracks.map((t) => ({ id: t.id, title: t.title, url: t.url }))}
            startIndex={startIndex}
            onTrackStart={handleTrackStart}
            renderActions={(t) => (
              <>
                <AddToPlaylistButton trackId={t.id} />
                {release.genre && (
                  <Link href={`/radio?genre=${encodeURIComponent(release.genre)}&from=${t.id}`} className="btn ghost">
                    Radio
                  </Link>
                )}
                <ShareButton
                  path={`/release/${release.id}?t=${t.id}`}
                  title={`${t.title} — ${artistName || ''}`}
                  label="Del"
                />
              </>
            )}
          />
        )}
        {tracks.length > 0 && !canInteract && (
          <div>
            {tracks.map((t) => (
              <div className="track-row" key={t.id}>
                <div className="ttitle">{t.title}</div>
                <span className="notice">Log ind for at lytte.</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default function ReleasePage() {
  return (
    <Suspense fallback={<p className="notice">Henter...</p>}>
      <ReleaseContent />
    </Suspense>
  )
}
