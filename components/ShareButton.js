'use client'
import { useEffect, useRef, useState } from 'react'

// path skal være en relativ sti, fx "/release/abc-123". Den fulde URL bygges
// først ved klik, så komponenten er sikker at bruge under server-rendering.
export default function ShareButton({ path, title, label = 'Del' }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const wrapperRef = useRef(null)

  useEffect(() => {
    function handleOutsideClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  function fullUrl() {
    return window.location.origin + path
  }

  async function handleClick() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url: fullUrl() })
      } catch {
        // Brugeren annullerede delingen — ikke en fejl, gør intet
      }
      return
    }
    setMenuOpen((open) => !open)
  }

  function shareViaSms() {
    const body = encodeURIComponent(`${title} ${fullUrl()}`)
    window.location.href = `sms:?body=${body}`
    setMenuOpen(false)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(fullUrl())
      setFeedback('Link kopieret!')
    } catch {
      setFeedback('Kunne ikke kopiere linket.')
    }
    setMenuOpen(false)
    setTimeout(() => setFeedback(''), 2500)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className="btn ghost" onClick={handleClick}>
        {label}
      </button>
      {menuOpen && (
        <div
          className="panel"
          style={{ position: 'absolute', top: '110%', right: 0, zIndex: 20, padding: 8, minWidth: 150 }}
        >
          <button
            type="button"
            className="btn ghost"
            style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }}
            onClick={shareViaSms}
          >
            Del via sms
          </button>
          <button
            type="button"
            className="btn ghost"
            style={{ display: 'block', width: '100%', textAlign: 'left' }}
            onClick={copyLink}
          >
            Kopiér link
          </button>
        </div>
      )}
      {feedback && (
        <div className="notice" style={{ position: 'absolute', top: '110%', right: 0, marginTop: 4, whiteSpace: 'nowrap' }}>
          {feedback}
        </div>
      )}
    </div>
  )
}
