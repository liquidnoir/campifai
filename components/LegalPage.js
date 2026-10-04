'use client'
import { useEffect } from 'react'
import { useLanguage } from './LanguageProvider'
import { LEGAL_DOCS, fillPlaceholders } from '../lib/legalContent'
import { SITE, missingSiteInfo } from '../lib/siteInfo'
import { formatLegalDate, siteValues } from '../lib/legalHelpers'

// En side med juridisk tekst (vilkår, privatlivspolitik, cookies, kontakt).
//   doc:   "terms" | "privacy" | "cookies" | "contact"
//   after: valgfrit { [afsnit-id]: element } — noget, der vises efter et bestemt afsnit
//          (bruges til anmeldelsesformularen på kontaktsiden)
export default function LegalPage({ doc, after = {} }) {
  const { t, lang } = useLanguage()
  const content = LEGAL_DOCS[doc][lang === 'en' ? 'en' : 'da']
  const values = siteValues(lang)
  const missing = missingSiteInfo()
  const fill = (text) => fillPlaceholders(text, values)

  // Hop til det afsnit, linket peger på (fx /terms#withdrawal)
  useEffect(() => {
    const id = window.location.hash.replace('#', '')
    if (id) document.getElementById(id)?.scrollIntoView()
  }, [lang, doc])

  return (
    <section style={{ maxWidth: 720 }}>
      <h2>{content.title}</h2>
      <p className="notice" style={{ marginTop: 6 }}>
        {t('legal.updated', { date: formatLegalDate(SITE.legalUpdated, lang) })}
      </p>

      {missing.length > 0 && (
        <div className="error-msg" style={{ marginTop: 16 }}>
          {t('legal.setupWarning', { fields: missing.join(', ') })}
        </div>
      )}

      <p style={{ marginTop: 16, lineHeight: 1.6 }}>{fill(content.intro)}</p>

      {content.sections.map((section) => (
        <div key={section.id}>
          <h3 id={section.id} style={{ fontSize: 17, marginTop: 28, marginBottom: 8, scrollMarginTop: 80 }}>
            {section.heading}
          </h3>
          {section.blocks.map((block, index) =>
            typeof block === 'string' ? (
              <p key={index} style={{ lineHeight: 1.6, marginBottom: 10 }}>{fill(block)}</p>
            ) : (
              <ul key={index} style={{ lineHeight: 1.6, paddingLeft: 20, marginBottom: 10 }}>
                {block.list.map((item, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>{fill(item)}</li>
                ))}
              </ul>
            )
          )}
          {after[section.id]}
        </div>
      ))}
    </section>
  )
}
