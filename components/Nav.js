'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function Nav() {
  const [session, setSession] = useState(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  async function logOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="top">
      <div className="top-inner">
        <Link href="/" className="logo">Rille</Link>
        <nav>
          {session ? (
            <>
              <Link href="/">Gennemse</Link>
              <Link href="/dashboard">Mit kontor</Link>
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
