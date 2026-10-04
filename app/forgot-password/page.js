'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { isRateLimitError } from '../../lib/authErrors'
import { useLanguage } from '../../components/LanguageProvider'

export default function ForgotPassword() {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const address = email.trim()
    if (!address) {
      setError(t('forgot.enterEmail'))
      return
    }
    setBusy(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setBusy(false)
    if (resetError) {
      setError(isRateLimitError(resetError) ? t('forgot.tooMany') : t('forgot.failed'))
      return
    }
    // Samme besked, uanset om der findes en konto med adressen — så man ikke kan bruge
    // siden til at finde ud af, hvem der har en konto.
    setSentTo(address)
  }

  return (
    <section>
      <h2>{t('forgot.title')}</h2>
      {sentTo ? (
        <div className="panel" style={{ maxWidth: 420, marginTop: 18 }}>
          <p style={{ lineHeight: 1.6 }}>{t('forgot.sent', { email: sentTo })}</p>
          <p style={{ marginTop: 14 }}>
            <Link href="/login">{t('forgot.backToLogin')}</Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="panel" style={{ maxWidth: 420, marginTop: 18 }}>
          <p className="notice" style={{ marginBottom: 14 }}>{t('forgot.intro')}</p>
          <div className="field">
            <label htmlFor="email">{t('login.email')}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? t('forgot.sending') : t('forgot.send')}
          </button>
          <p style={{ marginTop: 14 }}>
            <Link href="/login">{t('forgot.backToLogin')}</Link>
          </p>
        </form>
      )}
    </section>
  )
}
