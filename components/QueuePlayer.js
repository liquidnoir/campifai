'use client'
import { useEffect, useRef, useState } from 'react'

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
// autoStart: forsøg at starte afspilning automatisk (bruges når siden selv
// er navigeret til som følge af et klik, fx "Start radio")
export default function QueuePlayer({
  tracks: initialTracks,
  startIndex = 0,
  autoStart = false,
  loop = false,
  onTrackStart,
  emptyMessage = 'Ingen numre fundet.',
}) {
  const [tracks, setTracks] = useState(initialTracks)
  const [index, setIndex] = useState(startIndex)
  const [started, setStarted] = useState(!autoStart)
  const [needsTap, setNeedsTap] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => {
    setTracks(initialTracks)
    setIndex(startIndex)
  }, [initialTracks, startIndex])

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

  if (tracks.length === 0) return <p className="notice">{emptyMessage}</p>

  const current = tracks[index]

  return (
    <div>
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="notice">Nu spiller</div>
        <div style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>{current.title}</div>
        <div className="notice">
          {current.artistName}
          {current.releaseTitle ? ` · ${current.releaseTitle}` : ''}
        </div>
        {!started ? (
          <button className="btn" type="button" style={{ marginTop: 12 }} onClick={handleStart}>
            Afspil
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
                Tryk for at starte afspilning
              </button>
            )}
            <button className="btn ghost" type="button" style={{ marginTop: 12 }} onClick={handleEnded}>
              Næste
            </button>
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
              background: i === index && started ? 'var(--surface)' : undefined,
              borderRadius: 4,
            }}
            onClick={() => goTo(i)}
          >
            <div className="ttitle">
              {t.title}
              <div className="notice">{t.artistName}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
