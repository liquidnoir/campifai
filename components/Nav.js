'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { canPublish } from '../lib/shared'
import { useLanguage } from './LanguageProvider'

export default function Nav() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const router = useRouter()
  const { lang, setLang, t } = useLanguage()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id

  useEffect(() => {
    if (!userId) {
      setRole(null)
      return
    }
    supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
      .then(({ data }) => setRole(data?.role || null))
  }, [userId])

  async function logOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="top">
      <div className="top-inner">
        <Link href="/" className="logo">Campifai</Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Link href="/">{t('nav.browse')}</Link>
          {session ? (
            <>
              <Link href="/playlists">{t('nav.playlists')}</Link>
              {canPublish(role) && <Link href="/dashboard">{t('nav.releases')}</Link>}
              {role === 'admin' && <Link href="/admin">{t('nav.admin')}</Link>}
              <Link href="/account">{t('nav.account')}</Link>
              <button onClick={logOut} className="link-btn">{t('nav.logout')}</button>
            </>
          ) : (
            <>
              <Link href="/login">{t('nav.login')}</Link>
              <Link href="/signup">{t('nav.signup')}</Link>
            </>
          )}
          <span style={{ display: 'flex', gap: 4, fontSize: 13 }}>
            <button
              type="button"
              className="link-btn"
              onClick={() => setLang('da')}
              style={{ fontWeight: lang === 'da' ? 700 : 400 }}
              aria-current={lang === 'da'}
            >
              DA
            </button>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              className="link-btn"
              onClick={() => setLang('en')}
              style={{ fontWeight: lang === 'en' ? 700 : 400 }}
              aria-current={lang === 'en'}
            >
              EN
            </button>
          </span>
        </nav>
      </div>
    </header>
  )
}
