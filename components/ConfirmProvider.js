'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useLanguage } from './LanguageProvider'

// En pæn bekræftelsesdialog i stedet for browserens window.confirm.
//   const confirm = useConfirm()
//   if (!(await confirm('Slet ...?', { label: 'Slet', danger: true }))) return
const ConfirmContext = createContext(null)

export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm skal bruges inde i ConfirmProvider')
  return confirm
}

export function ConfirmProvider({ children }) {
  const { t } = useLanguage()
  const [dialog, setDialog] = useState(null) // { message, label, danger, resolve }
  const okRef = useRef(null)
  const returnFocusRef = useRef(null)

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      returnFocusRef.current = typeof document !== 'undefined' ? document.activeElement : null
      setDialog({ message, label: options.label || '', danger: Boolean(options.danger), resolve })
    })
  }, [])

  function close(answer) {
    if (!dialog) return
    dialog.resolve(answer)
    setDialog(null)
    const previous = returnFocusRef.current
    if (previous && typeof previous.focus === 'function') setTimeout(() => previous.focus(), 0)
  }

  // Fokus på knappen, så Enter bekræfter og Escape annullerer. Tab bliver inde i dialogen.
  useEffect(() => {
    if (!dialog) return undefined
    okRef.current?.focus()
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(false)
      } else if (event.key === 'Tab') {
        const buttons = Array.from(document.querySelectorAll('.confirm-dialog button'))
        if (buttons.length === 0) return
        const first = buttons[0]
        const last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div className="confirm-backdrop" onClick={() => close(false)}>
          <div
            className="confirm-dialog panel"
            role="alertdialog"
            aria-modal="true"
            aria-describedby="confirm-message"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="confirm-message" className="confirm-message">{dialog.message}</p>
            <div className="confirm-actions">
              <button type="button" className="btn ghost" onClick={() => close(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                ref={okRef}
                className={`btn${dialog.danger ? ' danger' : ''}`}
                onClick={() => close(true)}
              >
                {dialog.label || t('confirm.ok')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
