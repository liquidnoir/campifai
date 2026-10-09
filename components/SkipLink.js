'use client'
import { useLanguage } from './LanguageProvider'

// Første ting, tastaturet rammer: spring menuen over og gå direkte til indholdet. Vises kun ved fokus.
export default function SkipLink() {
  const { t } = useLanguage()
  return (
    <a href="#main" className="skip-link">
      {t('a11y.skipToContent')}
    </a>
  )
}
