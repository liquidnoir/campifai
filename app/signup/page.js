'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { MAX_ARTISTS } from '../../lib/shared'
import { useLanguage } from '../../components/LanguageProvider'

export default function Signup() {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('listener')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password || !displayName.trim()) {
      setError(t('signup.fillFields'))
      return
    }
    if (password.length < 6) {
      setError(t('signup.passwordTooShort'))
      return
    }
    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        role,
        display_name: displayName.trim(),
      })
      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }
    }
    setLoading(false)
    router.push('/')
  }

  return (
    <section>
      <h2>{t('signup.title')}</h2>
      <form onSubmit={handleSubmit} className="panel" style={{ maxWidth: 420, marginTop: 18 }}>
        <div className="field">
          <label>{t('signup.iAm')}</label>
          <div style={{ display: 'flex', gap: 18, fontSize: 14 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="radio" checked={role === 'listener'} onChange={() => setRole('listener')} />
              {t('role.listener')}
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="radio" checked={role === 'publisher'} onChange={() => setRole('publisher')} />
              {t('role.publisher')}
            </label>
          </div>
          {role === 'publisher' && (
            <div className="notice" style={{ marginTop: 6 }}>
              {t('signup.publisherHint', { max: MAX_ARTISTS })}
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="name">{t('signup.name')}</label>
          <input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="email">{t('login.email')}</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pw">{t('login.password')}</label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="error-msg">{error}</div>}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? t('signup.creating') : t('signup.title')}
        </button>
      </form>
    </section>
  )
}
