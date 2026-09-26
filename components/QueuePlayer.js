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
// loop: ved sidste nummer, bland forfra og fortsæt (bruges til radio)
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
  emptyMessage,
  renderActions,
}) {
  const { t } = useLanguage()
  const [tracks, setTracks] = useState(initialTracks)
  const [index, setIndex] = useState(startIndex)
  const [started, setStarted] = useState(autoStart)
  const [needsTap, setNeedsTap] = useState(false)
  const audioRef = useRef(null)
  const startRowRef = useRef(null)

  useEffect(() => {
    setTracks(initialTracks)
    setIndex(startIndex)
  }, [initialTracks, startIndex])

  // Rul den oprindeligt valgte række i syne, én gang ved indlæsning
  // (fx når man åbner et delt link til et bestemt nummer)
  useEffect(() => {
    startRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, started, tracks])

  function handleStart() {
    setStarted(true)
  }

  function goTo(i) {
    setStarted(true)
    setIndex(i)
  }

  function handleEnded() {
    setIndex((i) => {
      const next = i + 1
      if (next < tracks.length) return next
      if (!loop) return i
      setTracks((prev) => shuffle(prev))
      return 0
    })
  }

  if (tracks.length === 0) return <p className="notice">{emptyMessage || t('player.empty')}</p>

  const current = tracks[index]

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
            <audio ref={audioRef} controls onEnded={handleEnded} style={{ width: '100%', marginTop: 12 }} />
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
            {(tracks.length > 1 || loop) && (
              <button className="btn ghost" type="button" style={{ marginTop: 12 }} onClick={handleEnded}>
                {t('common.next')}
              </button>
            )}
          </>
        )}
      </div>
      <div>
        {tracks.map((t, i) => (
          <div
            key={`${t.id}-${i}`}
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
              {t.title}
              {t.artistName && <div className="notice">{t.artistName}</div>}
            </div>
            {renderActions && (
              <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 8 }}>
                {renderActions(t)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
