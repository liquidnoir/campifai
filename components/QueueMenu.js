'use client'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from './LanguageProvider'
import { usePlayer } from './PlayerProvider'

// Lille knap i en nummerrække med en rullemenu: "Afspil som næste" og "Tilføj til kø" (bagerst).
// Musikken, der spiller, afbrydes ikke. Er der intet i køen, starter nummeret i stedet.
const MENU_WIDTH = 190 // skal passe til .qm-menu i stilarket

export default function QueueMenu({ track }) {
  const { t } = useLanguage()
  const player = usePlayer()
  const [open, setOpen] = useState(false)
  const [upward, setUpward] = useState(false)
  const [alignLeft, setAlignLeft] = useState(false)
  const wrapperRef = useRef(null)
  const buttonRef = useRef(null)

  // Luk ved tryk udenfor og med Escape
  useEffect(() => {
    if (!open) return undefined
    function handlePointerDown(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  // Et nummer uden afspilningsadresse kan ikke lægges i køen
  if (!track?.url) return null

  function toggle() {
    if (!open) {
      // Er der ikke plads under knappen, åbner menuen opad. Er der ikke plads til venstre
      // (knappen står ofte yderst til venstre blandt rækkens knapper), åbner den mod højre.
      const rect = buttonRef.current.getBoundingClientRect()
      setUpward(window.innerHeight - rect.bottom < 150)
      setAlignLeft(rect.right - MENU_WIDTH < 8)
    }
    setOpen((value) => !value)
  }

  function choose(where) {
    setOpen(false)
    if (where === 'next') player.playNext(track)
    else player.addToQueue(track)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={buttonRef}
        type="button"
        className="btn ghost qm-btn"
        aria-label={t('queue.open')}
        title={t('queue.open')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h11M4 11h8M4 16h6" />
          <path d="M18 12v8M14 16h8" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="panel qm-menu"
          style={{ ...(upward ? { bottom: '110%' } : { top: '110%' }), ...(alignLeft ? { left: 0 } : { right: 0 }) }}
        >
          <button type="button" role="menuitem" className="qm-item" onClick={() => choose('next')}>
            {t('queue.playNext')}
          </button>
          <button type="button" role="menuitem" className="qm-item" onClick={() => choose('end')}>
            {t('queue.addToQueue')}
          </button>
        </div>
      )}
    </div>
  )
}
