'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLanguage } from './LanguageProvider'
import { usePlayer, usePlayerTime } from './PlayerProvider'
import QueuePanel from './QueuePanel'
import NowPlaying from './NowPlaying'
import { Icon } from './PlayerIcons'
import { formatClock, fractionOf } from '../lib/playerQueue'

// Linjen øverst i minispilleren: viser, hvor langt nummeret er, og kan trykkes eller trækkes i
function SeekBar() {
  const { t } = useLanguage()
  const { seek } = usePlayer()
  const { currentTime, duration } = usePlayerTime()
  const barRef = useRef(null)
  const [drag, setDrag] = useState(null) // andel (0–1) mens man trækker, ellers null

  const fraction = drag ?? fractionOf(currentTime, duration)

  function fractionFromEvent(event) {
    const rect = barRef.current.getBoundingClientRect()
    if (rect.width <= 0) return 0
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  }

  function handlePointerDown(event) {
    if (!(duration > 0)) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDrag(fractionFromEvent(event))
  }

  function handlePointerMove(event) {
    if (drag !== null) setDrag(fractionFromEvent(event))
  }

  function handlePointerUp(event) {
    if (drag === null) return
    const target = fractionFromEvent(event) * duration
    setDrag(null)
    seek(target)
  }

  function handleKeyDown(event) {
    if (!(duration > 0)) return
    const step = 5
    if (event.key === 'ArrowRight') seek(Math.min(duration, currentTime + step))
    else if (event.key === 'ArrowLeft') seek(Math.max(0, currentTime - step))
    else if (event.key === 'Home') seek(0)
    else if (event.key === 'End') seek(duration)
    else return
    event.preventDefault()
  }

  return (
    <div
      ref={barRef}
      className="mini-seek"
      role="slider"
      tabIndex={0}
      aria-label={t('player.mini.seek')}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration) || 0}
      aria-valuenow={Math.round(currentTime) || 0}
      aria-valuetext={`${formatClock(currentTime)} / ${formatClock(duration)}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDrag(null)}
      onKeyDown={handleKeyDown}
    >
      <div className="mini-seek-track">
        <div className="mini-seek-fill" style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  )
}

// Kort bekræftelse over minispilleren, når et nummer er lagt i køen
function QueueToast() {
  const { t } = useLanguage()
  const { notice } = usePlayer()
  if (!notice) return null
  return (
    <div className="queue-toast" role="status" aria-live="polite">
      {t(notice.kind === 'next' ? 'queue.toast.next' : 'queue.toast.added', { title: notice.title })}
    </div>
  )
}

// Minispilleren: vises nederst, så længe der er noget i afspillerens kø. Musikken fortsætter
// ved sideskift, og herfra kan man sætte på pause, gå til forrige/næste, søge og lukke.
export default function MiniPlayer() {
  const { t } = useLanguage()
  const player = usePlayer()
  const pathname = usePathname()
  const { current, playing, hasNext, hasPrevious, queue, index } = player
  const [queueOpen, setQueueOpen] = useState(false)
  const [fullOpen, setFullOpen] = useState(false)

  // Køen lukkes, når man skifter side, og når afspilleren lukkes
  useEffect(() => {
    setQueueOpen(false)
    setFullOpen(false)
  }, [pathname])
  useEffect(() => {
    if (!current) {
      setQueueOpen(false)
      setFullOpen(false)
    }
  }, [current])

  if (!current) return null
  const upcomingCount = Math.max(0, queue.length - index - 1)

  const artist = current.mediaArtist || current.artistName || ''
  const info = (
    <>
      <div
        className="mini-cover"
        style={current.coverUrl ? { backgroundImage: `url(${current.coverUrl})` } : undefined}
      />
      <div className="mini-text">
        <div className="mini-title">{current.title}</div>
        {artist && <div className="mini-artist">{artist}</div>}
      </div>
    </>
  )

  return (
    <>
    <QueueToast />
    {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}
    {fullOpen && (
      <NowPlaying
        onClose={() => setFullOpen(false)}
        onShowQueue={() => {
          setFullOpen(false)
          setQueueOpen(true)
        }}
      />
    )}
    <div className="miniplayer" role="region" aria-label={t('player.mini.aria')}>
      <SeekBar />
      <div className="mini-row">
        <button type="button" className="mini-info" aria-label={t('nowPlaying.open')} onClick={() => setFullOpen(true)}>
          {info}
        </button>
        <div className="mini-controls">
          {hasPrevious && (
            <button type="button" className="mini-btn" aria-label={t('player.mini.previous')} onClick={player.previous}>
              <Icon name="previous" />
            </button>
          )}
          <button
            type="button"
            className="mini-btn play"
            aria-label={playing ? t('player.mini.pause') : t('player.mini.play')}
            onClick={player.togglePlay}
          >
            <Icon name={playing ? 'pause' : 'play'} />
          </button>
          {hasNext && (
            <button type="button" className="mini-btn" aria-label={t('player.mini.next')} onClick={player.next}>
              <Icon name="next" />
            </button>
          )}
          <button
            type="button"
            className={`mini-btn queue-toggle${queueOpen ? ' on' : ''}`}
            aria-label={t('queue.view.open')}
            aria-expanded={queueOpen}
            onClick={() => setQueueOpen((open) => !open)}
          >
            <Icon name="queue" />
            {upcomingCount > 0 && <span className="mini-badge">{upcomingCount > 99 ? '99+' : upcomingCount}</span>}
          </button>
          <button type="button" className="mini-btn close" aria-label={t('player.mini.close')} onClick={player.stop}>
            <Icon name="close" />
          </button>
        </div>
      </div>
    </div>
    </>
  )
}
