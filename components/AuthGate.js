'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

// Nøjagtige sider man må se uden login
const PUBLIC_PATHS = ['/', '/login', '/signup']
// Sider man må browse uden login (kun visning, aldrig afspilning eller upload)
const PUBLIC_PREFIXES = ['/artist/', '/release/']

function isPublicPath(pathname) {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined) // undefined = tjekker stadig
  const pathname = usePathname()
  const router = useRouter()
  const isPublic = isPublicPath(pathname)

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
