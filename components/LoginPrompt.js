'use client'
import Link from 'next/link'
import { useLanguage } from './LanguageProvider'

// Vises i stedet for en gentagen "Log ind"-tekst på hver række, når man ikke er logget ind
export default function LoginPrompt() {
  const { t } = useLanguage()
  return (
    <div className="login-prompt panel">
      <h3>{t('loginPrompt.title')}</h3>
      <p className="notice">{t('loginPrompt.text')}</p>
      <div className="login-prompt-actions">
        <Link href="/login" className="btn">{t('nav.login')}</Link>
        <Link href="/signup" className="btn ghost">{t('nav.signup')}</Link>
      </div>
    </div>
  )
}
