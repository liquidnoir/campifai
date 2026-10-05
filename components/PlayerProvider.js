'use client'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  audioMimeFromUrl,
  buildMediaMetadata,
  isGenericMime,
  isPrefetchTooLarge,
  mediaSessionSupported,
  shouldPrefetchNext,
} from '../lib/mediaSession'
import { shuffle } from '../lib/playerQueue'

// Hvor længe et fornyet afspilningslink er gyldigt (6 timer, som på siderne)
const SIGNED_URL_SECONDS = 60 * 60 * 6

const PlayerContext = createContext(null)
const TimeContext = createContext({ currentTime: 0, duration: 0 })

// Den fælles afspiller: tilstand og handlinger (køen, hvad der spiller, afspil/pause, næste ...)
export function usePlayer() {
  const value = useContext(PlayerContext)
  if (!value) throw new Error('usePlayer skal bruges inde i PlayerProvider')
  return value
}

// Hvor langt nummeret er (opdateres ofte, så den er holdt adskilt — kun søgelinjen bruger den)
export function usePlayerTime() {
  return useContext(TimeContext)
}

function emptyPrefetch() {
  return { url: '', status: 'idle', blobUrl: '', controller: null }
}

// Ét lydelement i appens rod. Siderne giver afspilleren en kø (playQueue), og musikken fortsætter,
// også når man skifter side, fordi lydelementet ikke hører til nogen side.
//
// Køens numre: { id, title, url, artistName?, mediaArtist?, releaseTitle?, releaseId?, coverUrl?, audioPath? }
//   mediaArtist (kunstnerens fulde navn), releaseTitle og coverUrl vises på låseskærm og hovedtelefoner.
//   audioPath bruges til at forny et afspilningslink, der er udløbet.
//
// playQueue(tracks, startIndex, { sourceKey, loop, onNeedMore })
//   sourceKey: navnet på kilden (fx "release:abc"), så en side kan se, om dens liste er den, der spiller
//   loop: når køen er løbet tør (og onNeedMore ikke har mere), bland forfra og fortsæt (radio)
//   onNeedMore: async funktion, der returnerer flere numre at lægge bag i køen (radio). Kaldes i god
//     tid, før køen er slut. Returnerer den [], er der ikke mere at hente.
export function PlayerProvider({ children }) {
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(0)
  // Tælles op, hver gang et nummer med vilje skal (gen)startes. Det styrer afspilningen — ikke selve
  // køen, for ellers ville nummeret genstarte, hver gang der lægges flere numre bag i køen.
  const [playKey, setPlayKey] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)
  const [sourceKey, setSourceKey] = useState('')
  const [loop, setLoop] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [time, setTime] = useState({ currentTime: 0, duration: 0 })

  const audioRef = useRef(null)
  const queueRef = useRef(queue)
  const indexRef = useRef(index)
  const loopRef = useRef(loop)
  const onNeedMoreRef = useRef(null)
  const exhaustedRef = useRef(false)
  const moreRef = useRef(null)
  const handlersRef = useRef({})
  const prefetchRef = useRef(emptyPrefetch())
  const playingBlobRef = useRef('') // hukommelsesadressen for det nummer, der spiller nu (frigives, når vi skifter)
  const lastPositionSecondRef = useRef(-1)
  const lastTimeTickRef = useRef(-1)
  const retriedRef = useRef('')
  const playKeyRef = useRef(playKey)
  queueRef.current = queue
  playKeyRef.current = playKey
  indexRef.current = index
  loopRef.current = loop

  // ---- Handlinger. De bruger kun refs og tilstandsfunktioner, så de er de samme hele livet ----
  const apiRef = useRef(null)
  if (!apiRef.current) {
    // Henter flere numre ind bag i køen. Flere kald på én gang deler det samme svar.
    const requestMore = () => {
      if (!onNeedMoreRef.current || exhaustedRef.current) return Promise.resolve(0)
      if (moreRef.current) return moreRef.current
      const promise = (async () => {
        try {
          const more = await onNeedMoreRef.current()
          if (!more || more.length === 0) {
            exhaustedRef.current = true
            return 0
          }
          setQueue((prev) => [...prev, ...more])
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

    const goTo = (i) => {
      setIndex(i)
      setPlayKey((k) => k + 1)
    }

    const next = async () => {
      const i = indexRef.current
      if (i + 1 < queueRef.current.length) {
        goTo(i + 1)
        return
      }
      // Sidste nummer: prøv først at hente flere, ellers bland forfra (hvis loop)
      const added = await requestMore()
      if (added > 0) {
        goTo(i + 1)
        return
      }
      if (loopRef.current) {
        setQueue((prev) => shuffle(prev))
        goTo(0)
      }
    }

    const previous = () => {
      const i = indexRef.current
      if (i > 0) goTo(i - 1)
    }

    const playQueue = (tracks, startIndex = 0, options = {}) => {
      const list = Array.isArray(tracks) ? tracks : []
      if (list.length === 0) return
      const start = Math.min(Math.max(0, startIndex || 0), list.length - 1)
      onNeedMoreRef.current = options.onNeedMore || null
      exhaustedRef.current = false
      moreRef.current = null
      setHasMore(Boolean(options.onNeedMore))
      setLoop(Boolean(options.loop))
      setSourceKey(options.sourceKey || '')
      setQueue(list)
      setIndex(start)
      setPlayKey((k) => k + 1)
    }

    const playIndex = (i) => {
      if (i < 0 || i >= queueRef.current.length) return
      goTo(i)
    }

    const play = () => {
      audioRef.current?.play()?.catch?.(() => {})
    }

    const pause = () => {
      audioRef.current?.pause()
    }

    const togglePlay = () => {
      const el = audioRef.current
      if (!el) return
      if (el.paused) play()
      else pause()
    }

    const seek = (seconds) => {
      const el = audioRef.current
      if (!el || !Number.isFinite(seconds)) return
      el.currentTime = Math.max(0, seconds)
    }

    // Luk afspilleren: stop lyden, og glem køen
    const stop = () => {
      const el = audioRef.current
      if (el) {
        el.pause()
        el.removeAttribute('src')
        el.load?.()
      }
      onNeedMoreRef.current = null
      exhaustedRef.current = false
      moreRef.current = null
      setQueue([])
      setIndex(0)
      setSourceKey('')
      setLoop(false)
      setHasMore(false)
      setPlaying(false)
      setNeedsTap(false)
      setTime({ currentTime: 0, duration: 0 })
    }

    apiRef.current = { playQueue, playIndex, play, pause, togglePlay, next, previous, seek, stop, requestMore, goTo }
  }
  const api = apiRef.current

  // ---- Forhåndsindlæsning af næste nummer ----
  // Afbryder en igangværende forhåndsindlæsning og frigiver det, der er hentet
  function releasePrefetch() {
    const slot = prefetchRef.current
    slot.controller?.abort()
    if (slot.blobUrl) URL.revokeObjectURL(slot.blobUrl)
    prefetchRef.current = emptyPrefetch()
  }

  // Henter næste nummer ind i hukommelsen. Går noget galt, markeres det som opgivet (så der ikke
  // prøves igen og igen), og nummeret streames bare som normalt, når det skal spille.
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
    const nextTrack = queueRef.current[indexRef.current + 1]
    if (!nextTrack?.url) return
    if (prefetchRef.current.url === nextTrack.url) return // allerede hentet, i gang eller opgivet
    if (!shouldPrefetchNext({ currentTime: el.currentTime, duration: el.duration, connection: navigator.connection })) return
    startPrefetch(nextTrack.url)
  }

  // ---- Låseskærm og hovedtelefoner ----
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

  // ---- Hændelser fra lydelementet ----
  function handleTimeUpdate(event) {
    const el = event.currentTarget
    // Søgelinjen opdateres to gange i sekundet (ikke fire), for at spare på arbejdet
    const tick = Math.floor((el.currentTime || 0) * 2)
    if (tick !== lastTimeTickRef.current) {
      lastTimeTickRef.current = tick
      setTime({ currentTime: el.currentTime || 0, duration: Number.isFinite(el.duration) ? el.duration : 0 })
    }
    // Låseskærmen: højst én opdatering pr. sekund — og et sekund regnes først for udført, når den er sendt
    const second = Math.floor(el.currentTime || 0)
    if (second !== lastPositionSecondRef.current && updatePositionState(el)) {
      lastPositionSecondRef.current = second
    }
    maybePrefetch(el)
  }

  function handleDurationChange(event) {
    const el = event.currentTarget
    setTime({ currentTime: el.currentTime || 0, duration: Number.isFinite(el.duration) ? el.duration : 0 })
    updatePositionState(el)
  }

  function handleEnded() {
    setPlaybackState('paused')
    api.next()
  }

  // Et nummer kan ikke afspilles. To mulige årsager, som hver får ét forsøg:
  //  1) nummeret spiller fra en forhåndshentet kopi, der driller → brug i stedet det almindelige link
  //  2) linket er udløbet → hent et nyt og fortsæt, hvor vi var
  async function handleError() {
    const el = audioRef.current
    const current = queueRef.current[indexRef.current]
    if (!el || !current || retriedRef.current === `${indexRef.current}:${current.id}`) return
    retriedRef.current = `${indexRef.current}:${current.id}`
    const startedAt = playKeyRef.current
    const resumeAt = el.currentTime || 0
    let url = ''
    if (playingBlobRef.current && el.src === playingBlobRef.current && current.url) {
      url = current.url
      URL.revokeObjectURL(playingBlobRef.current)
      playingBlobRef.current = ''
    } else if (current.audioPath) {
      try {
        const { data } = await supabase.storage.from('tracks').createSignedUrl(current.audioPath, SIGNED_URL_SECONDS)
        url = data?.signedUrl || ''
      } catch {
        url = ''
      }
      if (!url || playKeyRef.current !== startedAt) return // andet nummer er startet imens
      setQueue((prev) => prev.map((x, i) => (i === indexRef.current && x.id === current.id ? { ...x, url } : x)))
    }
    if (!url) return
    el.src = url
    if (resumeAt > 0) el.currentTime = resumeAt
    el.play()?.catch?.(() => setNeedsTap(true))
  }


  // ---- Start et nummer, når afspilleren beder om det ----
  useEffect(() => {
    if (playKey === 0) return
    const el = audioRef.current
    const current = queue[index]
    if (!el || !current) return
    // Et nummer uden afspilningsadresse springes over, hvis der er et næste
    if (!current.url) {
      if (index + 1 < queue.length) api.goTo(index + 1)
      return
    }
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
    lastTimeTickRef.current = -1
    retriedRef.current = ''
    setTime({ currentTime: 0, duration: 0 })
    el.play()
      .then(() => setNeedsTap(false))
      .catch(() => setNeedsTap(true))
    // Afspilningstælleren (kun ét kald pr. startet nummer; en fejl her påvirker ikke afspilningen)
    try {
      Promise.resolve(supabase.rpc('increment_play_count', { track_id: current.id })).catch(() => {})
    } catch {
      // ikke afgørende
    }
    // Hent flere numre i god tid, så der ikke bliver pause ved slutningen af køen
    if (queue.length - index <= 2) api.requestMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey])

  const current = queue[index] || null
  const hasPrevious = index > 0
  const hasNext = index + 1 < queue.length || loop || hasMore
  handlersRef.current = { next: api.next, previous: api.previous }

  // Låseskærm og hovedtelefoner: titel, kunstner, album og cover for det nummer, der spiller
  useEffect(() => {
    if (!current || !mediaSessionSupported()) return
    try {
      navigator.mediaSession.metadata = new MediaMetadata(buildMediaMetadata(current))
    } catch {
      // ikke afgørende
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, playKey])

  // Knapperne på låseskærm og hovedtelefoner. Forrige og næste vises kun, når der er noget at gå til.
  const hasQueue = queue.length > 0
  useEffect(() => {
    if (!hasQueue || !mediaSessionSupported()) return
    const session = navigator.mediaSession
    const set = (action, handler) => {
      try {
        session.setActionHandler(action, handler)
      } catch {
        // handlingen understøttes ikke i denne browser
      }
    }
    set('play', () => api.play())
    set('pause', () => api.pause())
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
  }, [hasQueue, hasNext, hasPrevious])

  // Når køen er tom, fjernes tekster og knapper fra låseskærmen
  useEffect(() => {
    if (hasQueue || !mediaSessionSupported()) return
    try {
      navigator.mediaSession.metadata = null
      navigator.mediaSession.playbackState = 'none'
      for (const action of ['play', 'pause', 'seekto', 'nexttrack', 'previoustrack']) {
        navigator.mediaSession.setActionHandler(action, null)
      }
    } catch {
      // ikke afgørende
    }
    releasePrefetch()
    if (playingBlobRef.current) {
      URL.revokeObjectURL(playingBlobRef.current)
      playingBlobRef.current = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasQueue])

  // Siden gør plads til minispilleren nederst, så intet gemmer sig bag den
  useEffect(() => {
    document.documentElement.classList.toggle('has-player', hasQueue)
    return () => document.documentElement.classList.remove('has-player')
  }, [hasQueue])

  // Logger man ud, skal musikken stoppe (afspilleren overlever ellers sideskiftet til login)
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') api.stop()
    })
    return () => listener.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Frigiv alt, når appen lukkes ned
  useEffect(() => {
    return () => {
      releasePrefetch()
      if (playingBlobRef.current) URL.revokeObjectURL(playingBlobRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({ queue, index, current, playing, needsTap, sourceKey, hasNext, hasPrevious, loop, ...api }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queue, index, playing, needsTap, sourceKey, hasNext, hasPrevious, loop]
  )

  return (
    <PlayerContext.Provider value={value}>
      <TimeContext.Provider value={time}>
        {children}
        <audio
          ref={audioRef}
          preload="auto"
          style={{ display: 'none' }}
          onEnded={handleEnded}
          onPlay={() => {
            setPlaying(true)
            setNeedsTap(false)
            setPlaybackState('playing')
          }}
          onPause={() => {
            setPlaying(false)
            setPlaybackState('paused')
          }}
          onTimeUpdate={handleTimeUpdate}
          onDurationChange={handleDurationChange}
          onError={handleError}
        />
      </TimeContext.Provider>
    </PlayerContext.Provider>
  )
}
