'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { isTabActive, tabsFor } from '../lib/tabs'
import { useLanguage } from './LanguageProvider'

// Ikoner (enkle streger i samme farve som teksten)
const ICONS = {
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v10h13V10" />
    </>
  ),
  radio: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4" />
      <path d="M16.2 7.8a6 6 0 0 1 0 8.4" />
      <path d="M4.9 4.9a10 10 0 0 0 0 14.2" />
      <path d="M19.1 4.9a10 10 0 0 1 0 14.2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  playlists: (
    <>
      <path d="M4 6h11M4 11h11M4 16h6" />
      <circle cx="17" cy="17" r="2.5" />
      <path d="M19.5 17V8" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6" />
    </>
  ),
  login: (
    <>
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H4" />
      <path d="M14 4h5v16h-5" />
    </>
  ),
}

function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  )
}

function focusSearch() {
  const el = document.getElementById('search')
  if (!el) return false
  el.scrollIntoView({ block: 'center' })
  el.focus()
  return true
}

// Efter et sideskift: vent, til forsidens søgefelt findes, og sæt markøren der
function focusSearchWhenReady() {
  let tries = 0
  const timer = setInterval(() => {
    tries += 1
    if (window.location.pathname === '/' && focusSearch()) clearInterval(timer)
    else if (tries > 40) clearInterval(timer)
  }, 60)
}

// Bundmenuen. Vises kun, når siden kører som installeret app (klassen "standalone" på <html>,
// sat af et lille script i <head>) og på smalle skærme — det styrer stilarket.
export default function TabBar() {
  const { t } = useLanguage()
  const pathname = usePathname()
  const router = useRouter()
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(Boolean(data.session)))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setLoggedIn(Boolean(session)))
    return () => listener.subscription.unsubscribe()
  }, [])

  function handleSearch() {
    if (pathname === '/') {
      focusSearch()
      return
    }
    router.push('/')
    focusSearchWhenReady()
  }

  return (
    <nav className="tabbar" aria-label={t('tabs.aria')}>
      {tabsFor(loggedIn).map((tab) => {
        if (tab.id === 'search') {
          return (
            <button key={tab.id} type="button" className="tab" onClick={handleSearch}>
              <Icon name="search" />
              <span>{t(tab.labelKey)}</span>
            </button>
          )
        }
        const active = isTabActive(tab, pathname)
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`tab${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon name={tab.id} />
            <span>{t(tab.labelKey)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
