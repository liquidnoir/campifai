'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLanguage } from './LanguageProvider'

// Lille link nederst på en side: "Anmeld indhold". Fører til anmeldelsesformularen
// med adressen på den aktuelle side udfyldt.
export default function ReportLink() {
  const { t } = useLanguage()
  const pathname = usePathname()
  return (
    <p style={{ marginTop: 40 }}>
      <Link href={`/contact?url=${encodeURIComponent(pathname || '/')}#report`} className="notice">
        {t('legal.reportLink')}
      </Link>
    </p>
  )
}
