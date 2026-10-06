'use client'
import Link from 'next/link'
import { useLanguage } from './LanguageProvider'
import { SITE } from '../lib/siteInfo'

// Bund på alle sider: de juridiske sider, kontakt og Om os
export default function Footer() {
  const { t } = useLanguage()
  return (
    <footer className="site-footer">
      <div className="wrap">
        <nav className="site-footer-links">
          <Link href="/terms">{t('footer.terms')}</Link>
          <Link href="/privacy">{t('footer.privacy')}</Link>
          <Link href="/cookies">{t('footer.cookies')}</Link>
          <Link href="/contact">{t('footer.contact')}</Link>
          <Link href="/about">{t('footer.about')}</Link>
        </nav>
        <div>{SITE.name}</div>
      </div>
    </footer>
  )
}
