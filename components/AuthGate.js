'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

// Sider man må se uden at være logget ind.
// Forsiden viser kun titler, aldrig afspilning, så den er også offentlig.
const PUBLIC_PATHS = ['/', '/login', '/signup']

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined) // undefined = tjekker stadig
  const pathname = usePathname()
  const router = useRouter()
  const isPublic = PUBLIC_PATHS.includes(pathname)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === null && !isPublic) router.replace('/login')
  }, [session, isPublic])

  if (isPublic) return children
  if (session === undefined) return <p className="notice">Henter...</p>
  if (session === null) return null
  return children
}
