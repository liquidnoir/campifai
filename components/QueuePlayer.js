'use client'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from './LanguageProvider'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// tracks: [{ id, title, artistName, releaseTitle, url }]
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

  useEffect(() => {
    if (!started) return
    const el = audioRef.current
    const current = tracks[index]
    if (!el || !current) return
    el.src = current.url
    el.play()
      .then(() => setNeedsTap(false))
      .catch(() => setNeedsTap(true))
    onTrackStart?.(current)
    // Hent flere numre i god tid, så der ikke bliver pause ved slutningen af køen
    if (tracks.length - index <= 2) requestMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey, started])

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
  const showPrevious = index > 0
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
            <audio ref={audioRef} controls onEnded={handleNext} style={{ width: '100%', marginTop: 12 }} />
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
