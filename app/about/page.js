'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getAppSettings } from '../../lib/appSettings'
import { useLanguage } from '../../components/LanguageProvider'

// "Om os": overskrift og tekst, som admin selv kan ændre (Admin, forsidebillede og Om os-tekst).
// Er der ikke skrevet noget, vises standardteksten.
export default function AboutPage() {
  const { t, lang } = useLanguage()
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    let active = true
    getAppSettings(supabase).then((loaded) => {
      if (active) setSettings(loaded)
    })
    return () => {
      active = false
    }
  }, [])

  // Vent på indstillingerne, så standardteksten ikke vises et øjeblik, før admins egen tekst dukker op
  if (!settings) {
    return (
      <section className="hero">
        <div className="hero-text" aria-busy="true" />
      </section>
    )
  }

  const title = (lang === 'da' ? settings.heroTitleDa : settings.heroTitleEn)?.trim() || t('home.hero.title')
  const body = (lang === 'da' ? settings.heroBodyDa : settings.heroBodyEn)?.trim() || t('home.hero.body')

  return (
    <section className="hero about">
      <div className="hero-text">
        <h1>{title}</h1>
        <p style={{ whiteSpace: 'pre-line' }}>{body}</p>
      </div>
    </section>
  )
}
