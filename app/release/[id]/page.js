'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { imagePublicUrl } from '../../../lib/shared'
import { hasReleaseAccess } from '../../../lib/purchases'
import { downloadReleaseZip } from '../../../lib/zipDownload'
import { logDownload } from '../../../lib/logDownload'
import { useLanguage } from '../../../components/LanguageProvider'
import ShareButton from '../../../components/ShareButton'
import TrackList from '../../../components/TrackList'
import TrackMenu from '../../../components/TrackMenu'
import LoginPrompt from '../../../components/LoginPrompt'
import { PageSkeleton } from '../../../components/Skeletons'
import { usePlayer } from '../../../components/PlayerProvider'
import { useDurations, splitTotal } from '../../../lib/useDurations'
import PurchaseGate from '../../../components/PurchaseGate'
import PaymentReturn from '../../../components/PaymentReturn'
import ReportLink from '../../../components/ReportLink'

// Hvor længe et afspilningslink er gyldigt (6 timer)
const SIGNED_URL_SECONDS = 60 * 60 * 6

function ReleaseContent() {
  const { t } = useLanguage()
  const player = usePlayer()
  const { id } = useParams()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('t')
  const [session, setSession] = useState(undefined)
  const [release, setRelease] = useState(null)
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(null) // null = tjekker, true/false = kendt
  const [download, setDownload] = useState({ busy: false, progress: null, stage: null, error: null })
  const [downloadFormat, setDownloadFormat] = useState('') // tom = intet format valgt endnu
  // Numrenes længde læses fra lydfilerne, når man er logget ind (uden login er der ingen adgang til filerne)
  const durations = useDurations(session ? tracks : [])

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
        'id, title, type, color, cover_path, genre, artist_id, publisher_id, price_min_cents, price_suggested_cents, price_max_cents, artists ( name ), profiles ( display_name )'
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
      .select('*, artists ( name )')
      .eq('release_id', id)
      .order('position', { ascending: true })
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

  async function handleDownload() {
    if (!downloadFormat) return
    setDownload({ busy: true, progress: null, stage: null, error: null })
    try {
      const playable = tracks.filter((t) => t.url)
      if (playable.length === 0) throw new Error(t('release.noTracksToDownload'))
      await downloadReleaseZip(
        release,
        playable,
        (current, total, stage) => {
          setDownload({ busy: true, progress: { current, total }, stage, error: null })
        },
        t,
        downloadFormat
      )
      logDownload(supabase, { scope: 'release', releaseId: release.id, format: downloadFormat, trackCount: playable.length })
      setDownload({ busy: false, progress: null, stage: null, error: null })
    } catch (err) {
      setDownload({ busy: false, progress: null, stage: null, error: err.message || t('release.downloadFailed') })
    }
  }

  if (loading) return <PageSkeleton />
  if (!release) return <p className="notice">{t('release.notFound')}</p>

  const coverUrl = imagePublicUrl(supabase, release.cover_path)
  const publisherName = release.profiles?.display_name
  const artistName = release.artists?.name
  const showPublisher = publisherName && publisherName.trim().toLowerCase() !== (artistName || '').trim().toLowerCase()
  const canInteract = Boolean(session)

  const playerTracks = tracks.map((tr) => ({
    id: tr.id,
    title: tr.title,
    url: tr.url,
    artistName: tr.artist_id !== release.artist_id ? tr.artists?.name || '' : '',
    // Til låseskærm og hovedtelefoner (kunstneren vises altid dér)
    mediaArtist: tr.artists?.name || release.artists?.name || '',
    releaseTitle: release.title,
    releaseId: release.id,
    audioPath: tr.audio_path,
    coverUrl,
  }))
  const sourceKey = `release:${release.id}`
  const releaseActive = player.sourceKey === sourceKey && player.queue.length > 0
  const releasePlaying = releaseActive && player.playing
  const knownSeconds = tracks.reduce((sum, tr) => sum + (durations[tr.id] || 0), 0)
  const allDurationsKnown = tracks.length > 0 && tracks.every((tr) => durations[tr.id] > 0)
  const total = allDurationsKnown ? splitTotal(knownSeconds) : null

  function playRelease() {
    if (releaseActive) player.togglePlay()
    else if (playerTracks.length > 0) player.playQueue(playerTracks, startIndex, { sourceKey })
  }

  const startIndex = Math.max(
    0,
    tracks.findIndex((t) => t.id === highlightId)
  )

  return (
    <section>
      <PaymentReturn onConfirmed={checkAccess} />
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
                {t(`type.${release.type}`) || release.type}
                {release.genre ? ` · ${release.genre}` : ''}
              </div>
              <h2 style={{ marginTop: 4 }}>{release.title}</h2>
              <p className="notice" style={{ marginTop: 4 }}>
                <Link href={`/artist/${release.artist_id}`}>{artistName || t('home.unknownArtist')}</Link>
                {showPublisher && <> · {t('artist.publishedBy', { name: publisherName })}</>}
              </p>
            </div>
            <ShareButton
              path={`/release/${release.id}`}
              title={`${release.title} — ${artistName || ''}`}
              label={t('release.shareRelease')}
            />
          </div>
          <p className="notice" style={{ marginTop: 8 }}>
            {t('release.trackCount', { count: tracks.length })}
            {total && ` · ${total.hours > 0 ? t('release.total.hourMin', total) : t('release.total.min', total)}`}
          </p>
          {canInteract && tracks.length > 0 && (
            <button className="btn release-play" type="button" onClick={playRelease}>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                {releasePlaying ? (
                  <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
                ) : (
                  <path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5z" />
                )}
              </svg>
              {releasePlaying ? t('release.pause') : t('common.play')}
            </button>
          )}
        </div>
      </div>

      {canInteract && (
        <div style={{ marginTop: 20 }}>
          <PurchaseGate
            scope="release"
            releaseId={release.id}
            releaseType={release.type}
            priceOverrides={release}
            itemLabel={t('purchase.thisRelease', { title: release.title })}
            hasAccess={hasAccess}
            onGranted={checkAccess}
          />
          {hasAccess === true && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={downloadFormat}
                  onChange={(e) => setDownloadFormat(e.target.value)}
                  disabled={download.busy}
                  style={{ padding: '10px 8px' }}
                >
                  <option value="" disabled hidden>{t('download.format.placeholder')}</option>
                  {['mp3', 'flac'].map((fmt) => (
                    <option key={fmt} value={fmt}>
                      {downloadFormat === fmt
                        ? t('download.format.selected', { format: t(`download.format.${fmt}`) })
                        : t(`download.format.${fmt}`)}
                    </option>
                  ))}
                </select>
                <button className="btn ghost" type="button" disabled={download.busy || !downloadFormat} onClick={handleDownload}>
                  {download.busy
                    ? download.progress
                      ? t(download.stage === 'convert' ? 'download.converting' : 'common.fetching', {
                          current: download.progress.current,
                          total: download.progress.total,
                        })
                      : t('common.preparing')
                    : t('common.download')}
                </button>
              </div>
              <p className="notice" style={{ marginTop: 6 }}>{t('download.conversionNote')}</p>
              {download.error && <div className="error-msg">{download.error}</div>}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        {tracks.length === 0 && <p className="notice">{t('release.noTracksYet')}</p>}
        {tracks.length > 0 && canInteract && (
          <TrackList
            sourceKey={sourceKey}
            tracks={playerTracks}
            startIndex={startIndex}
            durations={durations}
            showPlayAll={false}
            renderActions={(track) => <TrackMenu track={track} genre={release.genre} />}
          />
        )}
        {tracks.length > 0 && !canInteract && (
          <div>
            <LoginPrompt />
            {tracks.map((tr, n) => (
              <div className="track-row" key={tr.id}>
                <div className="notice" style={{ width: 20, flexShrink: 0, textAlign: 'right' }}>{n + 1}</div>
                <div className="ttitle">{tr.title}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <ReportLink />
    </section>
  )
}

export default function ReleasePage() {
  const { t } = useLanguage()
  return (
    <Suspense fallback={<p className="notice">{t('common.loading')}</p>}>
      <ReleaseContent />
    </Suspense>
  )
}
