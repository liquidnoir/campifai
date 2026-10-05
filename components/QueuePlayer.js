'use client'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from './LanguageProvider'
import {
  audioMimeFromUrl,
  buildMediaMetadata,
  isGenericMime,
  isPrefetchTooLarge,
  mediaSessionSupported,
  shouldPrefetchNext,
} from '../lib/mediaSession'

function emptyPrefetch() {
  return { url: '', status: 'idle', blobUrl: '', controller: null }
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// tracks: [{ id, title, artistName, releaseTitle, url, coverUrl?, mediaArtist? }]
//   coverUrl og mediaArtist (kunstnerens fulde navn) bruges til låseskærmen og hovedtelefoner.
//
// Låseskærm og hovedtelefoner: titel, kunstner, album og cover vises, og knapperne (afspil, pause,
// forrige, næste og søgning) virker via browserens Media Session.
//
// Forhåndsindlæsning: når et nummer er halvvejs (eller der er under et minut tilbage), hentes det
// næste ind i hukommelsen, så det starter med det samme. Det springes over ved databesparelse og
// på langsom forbindelse, og hvis det ikke er nået at blive færdigt, streames nummeret som normalt.
// loop: når køen er løbet tør (og onNeedMore ikke har mere at give), bland forfra og fortsæt
//   (bruges til radio)
// onNeedMore: valgfri async funktion, der returnerer flere numre at lægge bag i køen
//   (bruges af radio til at fortsætte i andre genrer). Kaldes i god tid, før køen er slut,
//   så afspilningen ikke holder pause. Returnerer den [], er der ikke mere at hente.
// autoStart: forsøg at starte afspilning automatisk, med det samme
//   (bruges når siden selv er navigeret til som følge af et klik, fx "Start radio")
// renderActions(track): valgfri, renderer ekstra knapper i hver rækkes højre side
//   (klik der her bobler ikke op og skifter nummer)
export default function QueuePlayer({
  tracks: initialTracks,
  startIndex = 0,
  autoStart = false,
  loop = false,
  onTrackStart,
  onNeedMore,
  emptyMessage,
  renderActions,
}) {
  const { t } = useLanguage()
  const [tracks, setTracks] = useState(initialTracks)
  const [index, setIndex] = useState(startIndex)
  const [started, setStarted] = useState(autoStart)
  // Tælles op, hver gang et nummer med vilje skal (gen)startes. Det er det, der styrer
  // afspilningen — ikke selve listen, for ellers ville nummeret genstarte, hver gang der
  // blev lagt flere numre bag i køen.
  const [playKey, setPlayKey] = useState(0)
  const [needsTap, setNeedsTap] = useState(false)
  const audioRef = useRef(null)
  const startRowRef = useRef(null)
  const tracksRef = useRef(tracks)
  const indexRef = useRef(index)
  const moreRef = useRef(null)
  const exhaustedRef = useRef(false)
  const handlersRef = useRef({})
  const prefetchRef = useRef(emptyPrefetch())
  const playingBlobRef = useRef('') // hukommelsesadressen for det nummer, der spiller nu (frigives, når vi skifter)
  const lastPositionSecondRef = useRef(-1)
  tracksRef.current = tracks
  indexRef.current = index

  // Start forfra, men kun når listen reelt er en anden (ikke blot en ny array med samme indhold)
  const signature = initialTracks.map((x) => `${x.id}:${x.url ? 1 : 0}`).join('|')
  const appliedRef = useRef({ signature, startIndex })
  useEffect(() => {
    if (appliedRef.current.signature === signature && appliedRef.current.startIndex === startIndex) return
    appliedRef.current = { signature, startIndex }
    setTracks(initialTracks)
    setIndex(startIndex)
    setPlayKey((k) => k + 1)
    exhaustedRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, startIndex])

  // Rul den oprindeligt valgte række i syne, én gang ved indlæsning
  // (fx når man åbner et delt link til et bestemt nummer)
  useEffect(() => {
    startRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Henter flere numre ind bag i køen. Flere kald på én gang deler det samme svar.
  function requestMore() {
    if (!onNeedMore || exhaustedRef.current) return Promise.resolve(0)
    if (moreRef.current) return moreRef.current
    const promise = (async () => {
      try {
        const more = await onNeedMore()
        if (!more || more.length === 0) {
          exhaustedRef.current = true
          return 0
        }
        setTracks((prev) => [...prev, ...more])
        return more.length
      } catch {
        exhaustedRef.current = true
        return 0
      } finally {
        moreRef.current = null
      }
    })()
    moreRef.current = promise
    return promise
  }

  // Afbryder en igangværende forhåndsindlæsning og frigiver det, der er hentet
  function releasePrefetch() {
    const slot = prefetchRef.current
    slot.controller?.abort()
    if (slot.blobUrl) URL.revokeObjectURL(slot.blobUrl)
    prefetchRef.current = emptyPrefetch()
  }

  // Henter næste nummer ind i hukommelsen. Går noget galt, markeres det som opgivet (så der
  // ikke prøves igen og igen), og nummeret streames bare som normalt, når det skal spille.
  async function startPrefetch(url) {
    releasePrefetch()
    const controller = new AbortController()
    const slot = { url, status: 'loading', blobUrl: '', controller }
    prefetchRef.current = slot
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (isPrefetchTooLarge(res.headers.get('content-length'))) throw new Error('for stor')
      let blob = await res.blob()
      if (prefetchRef.current !== slot) return // afbrudt eller erstattet undervejs
      // Er filen gemt uden en brugbar type (ofte FLAC), udledes den af endelsen — ellers kan
      // nogle browsere, især Safari, nægte at afspille den fra hukommelsen
      if (isGenericMime(blob.type)) {
        const guessed = audioMimeFromUrl(url)
        if (guessed) blob = blob.slice(0, blob.size, guessed)
      }
      slot.blobUrl = URL.createObjectURL(blob)
      slot.status = 'ready'
    } catch {
      if (prefetchRef.current === slot) slot.status = 'failed'
    }
  }

  function maybePrefetch(el) {
    const next = tracksRef.current[indexRef.current + 1]
    if (!next?.url) return
    if (prefetchRef.current.url === next.url) return // allerede hentet, i gang eller opgivet
    if (!shouldPrefetchNext({ currentTime: el.currentTime, duration: el.duration, connection: navigator.connection })) return
    startPrefetch(next.url)
  }

  function setPlaybackState(state) {
    if (!mediaSessionSupported()) return
    try {
      navigator.mediaSession.playbackState = state
    } catch {
      // ikke afgørende
    }
  }

  // Fortæller låseskærmen, hvor langt nummeret er (så statuslinjen dér passer).
  // Returnerer true, hvis en opdatering blev forsøgt sendt (false, hvis længden endnu er ukendt).
  function updatePositionState(el) {
    if (!mediaSessionSupported() || typeof navigator.mediaSession.setPositionState !== 'function') return false
    const duration = el.duration
    if (!Number.isFinite(duration) || duration <= 0) return false
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: el.playbackRate || 1,
        position: Math.min(Math.max(el.currentTime || 0, 0), duration),
      })
    } catch {
      // nogle browsere afviser værdier midt i et skift — ikke afgørende
    }
    return true
  }

  function handleTimeUpdate(event) {
    const el = event.currentTarget
    // Højst én opdatering pr. sekund — og et sekund regnes først for udført, når den er sendt
    const second = Math.floor(el.currentTime || 0)
    if (second !== lastPositionSecondRef.current && updatePositionState(el)) {
      lastPositionSecondRef.current = second
    }
    maybePrefetch(el)
  }

  // Frigiv alt ved afslutning: forhåndshentet lyd, og låseskærmens knapper og tekster
  useEffect(() => {
    return () => {
      releasePrefetch()
      if (playingBlobRef.current) URL.revokeObjectURL(playingBlobRef.current)
      if (mediaSessionSupported()) {
        try {
          navigator.mediaSession.metadata = null
          navigator.mediaSession.playbackState = 'none'
          for (const action of ['play', 'pause', 'seekto', 'nexttrack', 'previoustrack']) {
            navigator.mediaSession.setActionHandler(action, null)
          }
        } catch {
          // ikke afgørende
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!started) return
    const el = audioRef.current
    const current = tracks[index]
    if (!el || !current) return
    // Er nummeret hentet ind på forhånd, bruges den kopi, så det starter med det samme.
    // Ellers streames det som normalt, og en halvfærdig forhåndsindlæsning afbrydes.
    const slot = prefetchRef.current
    const previousBlob = playingBlobRef.current
    let source = current.url
    if (slot.status === 'ready' && slot.url === current.url) {
      source = slot.blobUrl
      playingBlobRef.current = slot.blobUrl
      prefetchRef.current = emptyPrefetch() // kopien ejes nu af det spillende nummer
    } else {
      playingBlobRef.current = ''
      releasePrefetch()
    }
    el.src = source
    if (previousBlob) URL.revokeObjectURL(previousBlob)
    lastPositionSecondRef.current = -1
    el.play()
      .then(() => setNeedsTap(false))
      .catch(() => setNeedsTap(true))
    onTrackStart?.(current)
    // Hent flere numre i god tid, så der ikke bliver pause ved slutningen af køen
    if (tracks.length - index <= 2) requestMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey, started])

  // Låseskærm og hovedtelefoner: titel, kunstner, album og cover for det nummer, der spiller
  useEffect(() => {
    if (!started || !mediaSessionSupported()) return
    const current = tracks[index]
    if (!current) return
    try {
      navigator.mediaSession.metadata = new MediaMetadata(buildMediaMetadata(current))
    } catch {
      // ikke afgørende
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, playKey])

  const hasPrevious = index > 0
  const hasNext = index + 1 < tracks.length || loop || Boolean(onNeedMore)
  handlersRef.current = { next: handleNext, previous: handlePrevious }

  // Knapperne på låseskærm og hovedtelefoner. Forrige og næste vises kun, når der er noget at gå til.
  useEffect(() => {
    if (!started || !mediaSessionSupported()) return
    const session = navigator.mediaSession
    const set = (action, handler) => {
      try {
        session.setActionHandler(action, handler)
      } catch {
        // handlingen understøttes ikke i denne browser
      }
    }
    set('play', () => {
      audioRef.current?.play()?.catch?.(() => {})
    })
    set('pause', () => audioRef.current?.pause())
    set('seekto', (details) => {
      const el = audioRef.current
      if (el && typeof details?.seekTime === 'number') {
        el.currentTime = details.seekTime
        updatePositionState(el)
      }
    })
    set('nexttrack', hasNext ? () => handlersRef.current.next() : null)
    set('previoustrack', hasPrevious ? () => handlersRef.current.previous() : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, hasNext, hasPrevious])

  function handleEnded() {
    setPlaybackState('paused')
    handleNext()
  }

  function handleStart() {
    setStarted(true)
  }

  function goTo(i) {
    setStarted(true)
    setIndex(i)
    setPlayKey((k) => k + 1)
  }

  async function handleNext() {
    const i = indexRef.current
    if (i + 1 < tracksRef.current.length) {
      goTo(i + 1)
      return
    }
    // Sidste nummer: prøv først at hente flere, ellers bland forfra (hvis loop)
    const added = await requestMore()
    if (added > 0) {
      goTo(i + 1)
      return
    }
    if (loop) {
      setTracks((prev) => shuffle(prev))
      goTo(0)
    }
  }

  function handlePrevious() {
    const i = indexRef.current
    if (i > 0) goTo(i - 1)
  }

  if (tracks.length === 0) return <p className="notice">{emptyMessage || t('player.empty')}</p>

  const current = tracks[index]
  const showPrevious = hasPrevious
  const showNext = tracks.length > 1 || loop || Boolean(onNeedMore)

  return (
    <div>
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="notice">{t('player.nowPlaying')}</div>
        <div style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>{current.title}</div>
        {(current.artistName || current.releaseTitle) && (
          <div className="notice">
            {current.artistName}
            {current.releaseTitle ? ` · ${current.releaseTitle}` : ''}
          </div>
        )}
        {!started ? (
          <button className="btn" type="button" style={{ marginTop: 12 }} onClick={handleStart}>
            {t('common.play')}
          </button>
        ) : (
          <>
            <audio
              ref={audioRef}
              controls
              onEnded={handleEnded}
              onPlay={() => setPlaybackState('playing')}
              onPause={() => setPlaybackState('paused')}
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={(e) => updatePositionState(e.currentTarget)}
              style={{ width: '100%', marginTop: 12 }}
            />
            {needsTap && (
              <button
                className="btn"
                type="button"
                style={{ marginTop: 12, display: 'block' }}
                onClick={() => {
                  audioRef.current?.play()
                  setNeedsTap(false)
                }}
              >
                {t('player.tapToStart')}
              </button>
            )}
            {(showPrevious || showNext) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {showPrevious && (
                  <button className="btn ghost" type="button" onClick={handlePrevious}>
                    {t('common.previous')}
                  </button>
                )}
                {showNext && (
                  <button className="btn ghost" type="button" onClick={handleNext}>
                    {t('common.next')}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <div>
        {tracks.map((row, i) => (
          <div
            key={`${row.id}-${i}`}
            className="track-row"
            style={{
              cursor: 'pointer',
              background: i === index ? 'var(--surface)' : undefined,
              borderRadius: 4,
            }}
            onClick={() => goTo(i)}
            ref={i === startIndex ? startRowRef : null}
          >
            <div className="ttitle">
              {row.title}
              {row.artistName && <div className="notice">{row.artistName}</div>}
            </div>
            {renderActions && (
              <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 8 }}>
                {renderActions(row)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
