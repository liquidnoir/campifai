'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../components/LanguageProvider'

const MIN_PASSWORD_LENGTH = 6

// Siden, man kommer til fra linket i e-mailen om glemt adgangskode. Linket giver en midlertidig
// session, og med den kan man vælge en ny adgangskode.
export default function ResetPassword() {
  const { t } = useLanguage()
  const router = useRouter()
  const [state, setState] = useState('checking') // checking | ready | invalid | done
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    // Linket behandles af Supabase, når siden åbnes, og giver en "PASSWORD_RECOVERY"-hændelse
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setState((current) => (current === 'done' ? current : 'ready'))
      }
    })
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setState((current) => (current === 'checking' ? (data.session ? 'ready' : 'invalid') : current))
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('signup.passwordTooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('reset.mismatch'))
      return
    }
    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setBusy(false)
      setError(updateError.message || t('common.somethingWrong'))
      return
    }
    // Log ud af alle andre enheder, så en, der havde den gamle adgangskode, ikke er logget ind endnu
    try {
      await supabase.auth.signOut({ scope: 'others' })
    } catch {
      // ikke afgørende
    }
    setBusy(false)
    setState('done')
    setTimeout(() => router.push('/'), 1800)
  }

  if (state === 'checking') {
    return (
      <section>
        <h2>{t('reset.title')}</h2>
        <p className="notice" style={{ marginTop: 12 }}>{t('reset.checking')}</p>
      </section>
    )
  }

  if (state === 'invalid') {
    return (
      <section>
        <h2>{t('reset.title')}</h2>
        <div className="panel" style={{ maxWidth: 420, marginTop: 18 }}>
          <p style={{ lineHeight: 1.6 }}>{t('reset.invalid')}</p>
          <p style={{ marginTop: 14 }}>
            <Link href="/forgot-password">{t('reset.requestNew')}</Link>
          </p>
        </div>
      </section>
    )
  }

  if (state === 'done') {
    return (
      <section>
        <h2>{t('reset.title')}</h2>
        <div className="panel" style={{ maxWidth: 420, marginTop: 18 }}>
          <p style={{ lineHeight: 1.6 }}>{t('reset.done')}</p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2>{t('reset.title')}</h2>
      <form onSubmit={handleSubmit} className="panel" style={{ maxWidth: 420, marginTop: 18 }}>
        <p className="notice" style={{ marginBottom: 14 }}>{t('reset.intro')}</p>
        <div className="field">
          <label htmlFor="new-password">{t('reset.newPassword')}</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="confirm-password">{t('reset.confirm')}</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && <div className="error-msg">{error}</div>}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? t('reset.saving') : t('reset.save')}
        </button>
      </form>
    </section>
  )
}
