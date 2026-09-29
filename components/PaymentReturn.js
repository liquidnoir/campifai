'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from './LanguageProvider'

// Vises øverst på udgivelses- og kollektionssider. Gør kun noget, hvis adressen indeholder
// ?session_id=... (brugeren er lige kommet tilbage fra Stripe) eller ?canceled=1.
// onConfirmed kaldes, når betalingen er bekræftet, så siden kan genindlæse adgangen.
export default function PaymentReturn({ onConfirmed }) {
  const { t } = useLanguage()
  const [state, setState] = useState('idle') // idle | confirming | done | canceled | error
  const callbackRef = useRef(onConfirmed)
  callbackRef.current = onConfirmed

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    const canceled = params.get('canceled')
    if (!sessionId && !canceled) return

    // Ryd parametrene fra adressen, så en genindlæsning ikke gentager bekræftelsen
    params.delete('session_id')
    params.delete('canceled')
    const rest = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''))

    if (canceled) {
      setState('canceled')
      return
    }
    confirm(sessionId)
  }, [])

  async function confirm(sessionId) {
    setState('confirming')
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('not_logged_in')
      const res = await fetch('/api/checkout/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) throw new Error(body.error || 'failed')
      await callbackRef.current?.()
      setState('done')
    } catch {
      setState('error')
    }
  }

  if (state === 'idle') return null

  const messages = {
    confirming: t('payment.confirming'),
    done: t('payment.done'),
    canceled: t('payment.canceled'),
    error: t('payment.error'),
  }

  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <p className={state === 'error' ? 'error-msg' : 'notice'} style={{ margin: 0 }}>
        {messages[state]}
      </p>
    </div>
  )
}
