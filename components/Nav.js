'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { canPublish } from '../lib/shared'

export default function Nav() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const router = useRouter()

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
        <nav>
          <Link href="/">Gennemse</Link>
          {session ? (
            <>
              <Link href="/playlists">Playlister</Link>
              {canPublish(role) && <Link href="/dashboard">Udgivelser</Link>}
              {role === 'admin' && <Link href="/admin">Admin</Link>}
              <Link href="/account">Min konto</Link>
              <button onClick={logOut} className="link-btn">Log ud</button>
            </>
          ) : (
            <>
              <Link href="/login">Log ind</Link>
              <Link href="/signup">Opret konto</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
