'use client'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from './LanguageProvider'
import { usePlayer } from './PlayerProvider'

// Så mange kommende numre vises ad gangen (en radio kan have mange hundrede i køen)
const MAX_VISIBLE = 100

const ICONS = {
  up: <path d="M6 14l6-6 6 6" />,
  down: <path d="M6 10l6 6 6-6" />,
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
}

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

// Køen: det nummer, der spiller, og dem, der kommer. Man kan spille et nummer med det samme,
// flytte det op eller ned, fjerne det, eller rydde det hele. Det, der spiller, afbrydes aldrig.
export default function QueuePanel({ onClose }) {
  const { t } = useLanguage()
  const player = usePlayer()
  const { queue, index, current, hasMore } = player
  const [confirmClear, setConfirmClear] = useState(false)
  const sheetRef = useRef(null)

  const upcoming = queue.slice(index + 1)
  const visible = upcoming.slice(0, MAX_VISIBLE)

  // Fokus ind i arket, når det åbnes, og luk med Escape
  useEffect(() => {
    sheetRef.current?.focus()
  }, [])
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // "Ryd kø" kræver et tryk mere (og glemmer det igen efter et øjeblik), så man ikke rydder ved en fejl
  useEffect(() => {
    if (!confirmClear) return undefined
    const timer = setTimeout(() => setConfirmClear(false), 3000)
    return () => clearTimeout(timer)
  }, [confirmClear])

  function handleClear() {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    setConfirmClear(false)
    player.clearUpcoming()
  }

  const artistOf = (track) => track.mediaArtist || track.artistName || ''

  return (
    <>
      <div className="queue-backdrop" onClick={onClose} />
      <div ref={sheetRef} className="queue-sheet" role="dialog" aria-label={t('queue.view.title')} tabIndex={-1}>
        <div className="queue-sheet-head">
          <h3>{t('queue.view.title')}</h3>
          <span className="notice">{t('queue.view.count', { count: upcoming.length })}</span>
          <span style={{ flex: 1 }} />
          {upcoming.length > 0 && (
            <button type="button" className="queue-clear" onClick={handleClear}>
              {confirmClear ? t('queue.view.clearConfirm') : t('queue.view.clear')}
            </button>
          )}
          <button type="button" className="queue-act" aria-label={t('queue.view.close')} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        <div className="queue-sheet-body">
          <div className="queue-sec-title">{t('queue.view.nowPlaying')}</div>
          {current && (
            <div className="queue-item now">
              <div className="queue-item-main static">
                <span className="queue-item-title">{current.title}</span>
                {artistOf(current) && <span className="queue-item-sub">{artistOf(current)}</span>}
              </div>
            </div>
          )}

          <div className="queue-sec-title">{t('queue.view.next')}</div>
          {upcoming.length === 0 ? (
            <div className="queue-empty">
              <p>{t('queue.view.empty')}</p>
              <p className="notice">{t('queue.view.emptyHint')}</p>
            </div>
          ) : (
            visible.map((track, k) => {
              const queueIndex = index + 1 + k
              return (
                <div className="queue-item" key={track.qid ?? `${track.id}-${queueIndex}`}>
                  <button
                    type="button"
                    className="queue-item-main"
                    aria-label={t('queue.view.play', { title: track.title })}
                    onClick={() => player.playIndex(queueIndex)}
                  >
                    <span className="queue-item-title">{track.title}</span>
                    <span className="queue-item-sub">
                      {artistOf(track)}
                      {track.queued && <span className="queue-badge">{t('queue.view.badge')}</span>}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="queue-act"
                    aria-label={t('queue.view.moveUp')}
                    disabled={k === 0}
                    onClick={() => player.moveInQueue(queueIndex, queueIndex - 1)}
                  >
                    <Icon name="up" />
                  </button>
                  <button
                    type="button"
                    className="queue-act"
                    aria-label={t('queue.view.moveDown')}
                    disabled={queueIndex === queue.length - 1}
                    onClick={() => player.moveInQueue(queueIndex, queueIndex + 1)}
                  >
                    <Icon name="down" />
                  </button>
                  <button
                    type="button"
                    className="queue-act"
                    aria-label={t('queue.view.remove')}
                    onClick={() => player.removeFromQueue(queueIndex)}
                  >
                    <Icon name="close" />
                  </button>
                </div>
              )
            })
          )}
          {upcoming.length > MAX_VISIBLE && (
            <p className="notice" style={{ padding: '8px 6px' }}>
              {t('queue.view.more', { count: upcoming.length - MAX_VISIBLE })}
            </p>
          )}
          {hasMore && <p className="notice" style={{ padding: '8px 6px' }}>{t('queue.view.radioMore')}</p>}
        </div>
      </div>
    </>
  )
}
