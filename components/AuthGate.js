'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useLanguage } from './LanguageProvider'

// Nøjagtige sider man må se uden login
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/terms',
  '/privacy',
  '/cookies',
  '/contact',
  '/about',
  '/forgot-password',
  '/reset-password',
]
// Sider man må browse uden login (kun visning, aldrig afspilning, download eller upload)
const PUBLIC_PREFIXES = ['/artist/', '/release/', '/collections/']

function isPublicPath(pathname) {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

export default function AuthGate({ children }) {
  const { t } = useLanguage()
  const [session, setSession] = useState(undefined) // undefined = tjekker stadig
  const pathname = usePathname()
  const router = useRouter()
  const isPublic = isPublicPath(pathname)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      // Linket i e-mailen om glemt adgangskode fører brugeren til siden, hvor man vælger en ny
      if (event === 'PASSWORD_RECOVERY') router.replace('/reset-password')
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === null && !isPublic) router.replace('/login')
  }, [session, isPublic])

  if (isPublic) return children
  if (session === undefined) return <p className="notice">{t('common.loading')}</p>
  if (session === null) return null
  return children
}
