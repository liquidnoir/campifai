'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from './LanguageProvider'
import { usePlayer, usePlayerTime } from './PlayerProvider'
import FavoriteButton from './FavoriteButton'
import { Icon } from './PlayerIcons'
import { formatClock, fractionOf } from '../lib/playerQueue'

// Søgelinjen i fuldskærms-afspilleren, med tid til venstre og nummerets længde til højre
function NowSeek() {
  const { t } = useLanguage()
  const { seek } = usePlayer()
  const { currentTime, duration } = usePlayerTime()
  const barRef = useRef(null)
  const [drag, setDrag] = useState(null) // andel (0–1) mens man trækker

  const fraction = drag ?? fractionOf(currentTime, duration)
  const shown = drag !== null ? drag * duration : currentTime

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
    if (event.key === 'ArrowRight') seek(Math.min(duration, currentTime + 5))
    else if (event.key === 'ArrowLeft') seek(Math.max(0, currentTime - 5))
    else if (event.key === 'Home') seek(0)
    else if (event.key === 'End') seek(duration)
    else return
    event.preventDefault()
  }

  return (
    <div className="np-seek">
      <div
        ref={barRef}
        className="np-seek-bar"
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
        <div className="np-seek-track">
          <div className="np-seek-fill" style={{ width: `${fraction * 100}%` }} />
          <div className="np-seek-knob" style={{ left: `${fraction * 100}%` }} />
        </div>
      </div>
      <div className="np-times" aria-hidden="true">
        <span>{formatClock(shown)}</span>
        <span>{duration > 0 ? formatClock(duration) : '–:––'}</span>
      </div>
    </div>
  )
}

// Fuldskærms-afspilleren: stort cover, titel, søgelinje og store knapper. Åbnes ved tryk på minispilleren.
// Lukkes med pilen, Escape eller ved at trække nedad.
export default function NowPlaying({ onClose, onShowQueue }) {
  const { t } = useLanguage()
  const player = usePlayer()
  const { current, playing, hasNext, hasPrevious, queue, index } = player
  const rootRef = useRef(null)
  const touchRef = useRef(null)
  const returnFocusRef = useRef(null)

  // Fokus ind i afspilleren; Escape lukker; Tab bliver inde; siden bagved ruller ikke
  useEffect(() => {
    returnFocusRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    rootRef.current?.focus()
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      } else if (event.key === 'Tab' && rootRef.current) {
        const items = Array.from(rootRef.current.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]'))
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === rootRef.current)) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lukker og lægger fokus tilbage, hvor det var (minispillerens knap), så tastaturet ikke mister stedet
  function close() {
    const previous = returnFocusRef.current
    onClose()
    if (previous && typeof previous.focus === 'function') setTimeout(() => previous.focus(), 0)
  }

  if (!current) return null

  const artist = current.mediaArtist || current.artistName || ''
  const next = queue[index + 1]
  const releaseHref = current.releaseId ? `/release/${current.releaseId}?t=${current.id}` : null

  // Træk nedad (mere end 90 px, mest lodret) lukker. Starter trækket på søgelinjen, ignoreres det.
  function handleTouchStart(event) {
    if (event.target.closest('.np-seek-bar')) {
      touchRef.current = null
      return
    }
    const touch = event.touches[0]
    touchRef.current = { x: touch.clientX, y: touch.clientY }
  }
  function handleTouchEnd(event) {
    const start = touchRef.current
    touchRef.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    const dy = touch.clientY - start.y
    const dx = Math.abs(touch.clientX - start.x)
    if (dy > 90 && dy > dx * 1.5) close()
  }

  return (
    <div
      ref={rootRef}
      className="np"
      role="dialog"
      aria-modal="true"
      aria-label={t('nowPlaying.title')}
      tabIndex={-1}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {current.coverUrl && <div className="np-bg" style={{ backgroundImage: `url(${current.coverUrl})` }} aria-hidden="true" />}
      <div className="np-inner">
        <div className="np-top">
          <button type="button" className="np-icon-btn" aria-label={t('nowPlaying.close')} onClick={close}>
            <Icon name="chevronDown" />
          </button>
          <span className="np-label">{t('nowPlaying.title')}</span>
          <span className="np-icon-btn np-spacer" aria-hidden="true" />
        </div>

        <div
          className="np-cover"
          style={current.coverUrl ? { backgroundImage: `url(${current.coverUrl})` } : undefined}
          aria-hidden="true"
        />

        <div className="np-titles">
          <div className="np-text">
            <div className="np-title">{current.title}</div>
            {artist && <div className="np-artist">{artist}</div>}
            {releaseHref && (
              <Link href={releaseHref} className="np-link" onClick={onClose}>
                {current.releaseTitle ? t('nowPlaying.goToReleaseNamed', { title: current.releaseTitle }) : t('nowPlaying.goToRelease')}
              </Link>
            )}
          </div>
          <FavoriteButton trackId={current.id} title={current.title} className="np-fav" />
        </div>

        <NowSeek />

        <div className="np-controls">
          <button type="button" className="np-ctl" aria-label={t('player.mini.previous')} disabled={!hasPrevious} onClick={player.previous}>
            <Icon name="previous" />
          </button>
          <button
            type="button"
            className="np-ctl np-play"
            aria-label={playing ? t('player.mini.pause') : t('player.mini.play')}
            onClick={player.togglePlay}
          >
            <Icon name={playing ? 'pause' : 'play'} />
          </button>
          <button type="button" className="np-ctl" aria-label={t('player.mini.next')} disabled={!hasNext} onClick={player.next}>
            <Icon name="next" />
          </button>
        </div>

        <div className="np-foot">
          <div className="np-next">
            {next ? t('nowPlaying.next', { title: next.title }) : t('nowPlaying.nothingNext')}
          </div>
          <button type="button" className="np-queue-btn" onClick={onShowQueue}>
            <Icon name="queue" />
            {t('nowPlaying.showQueue')}
          </button>
        </div>
      </div>
    </div>
  )
}
