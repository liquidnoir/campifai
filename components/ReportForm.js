'use client'
import { useEffect, useState } from 'react'
import { useLanguage } from './LanguageProvider'
import { SITE } from '../lib/siteInfo'
import { buildReportMail, validateReport } from '../lib/legalHelpers'

// Formular til at anmelde indhold. Den samler en færdig e-mail med de oplysninger, en
// anmeldelse skal indeholde (adresse, begrundelse, navn og e-mail, god tro-erklæring).
// Intet sendes herfra: man åbner mailen i sit mailprogram eller kopierer teksten.
export default function ReportForm() {
  const { t, lang } = useLanguage()
  const [url, setUrl] = useState('')
  const [reason, setReason] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [goodFaith, setGoodFaith] = useState(false)
  const [errors, setErrors] = useState([])
  const [copied, setCopied] = useState(false)

  // Adressen på det indhold, man kom fra (fx via "Anmeld indhold" på en udgivelse)
  useEffect(() => {
    const path = new URLSearchParams(window.location.search).get('url')
    if (path) setUrl(path.startsWith('/') ? `${window.location.origin}${path}` : path)
  }, [])

  const fields = { url, reason, name, email, goodFaith }
  const mail = buildReportMail({ to: SITE.email, url, reason, name, email, lang })

  function check() {
    const found = validateReport(fields)
    setErrors(found)
    return found.length === 0
  }

  function openMail(event) {
    if (!check() || !mail.mailto) {
      event.preventDefault()
    }
  }

  async function copyText() {
    if (!check()) return
    try {
      await navigator.clipboard.writeText(`${mail.to}\n${mail.subject}\n\n${mail.body}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // Kopiering kan være blokeret — så kan man stadig bruge e-mail-knappen
    }
  }

  const err = (key) => errors.includes(key) && <div className="error-msg">{t(`report.error.${key}`)}</div>

  return (
    <form
      id="report-form"
      className="panel"
      style={{ marginTop: 14, marginBottom: 10 }}
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="field">
        <label htmlFor="report-url">{t('report.url')}</label>
        <input id="report-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        {err('url')}
      </div>
      <div className="field">
        <label htmlFor="report-reason">{t('report.reason')}</label>
        <textarea
          id="report-reason"
          rows={5}
          maxLength={1500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{
            width: '100%',
            fontFamily: 'inherit',
            fontSize: 15,
            padding: '9px 11px',
            border: '1px solid var(--border)',
            borderRadius: 3,
            background: 'var(--bg)',
            color: 'var(--ink)',
          }}
        />
        {err('reason')}
      </div>
      <div className="field">
        <label htmlFor="report-name">{t('report.name')}</label>
        <input id="report-name" value={name} onChange={(e) => setName(e.target.value)} />
        {err('name')}
      </div>
      <div className="field">
        <label htmlFor="report-email">{t('report.email')}</label>
        <input id="report-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {err('email')}
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={goodFaith}
          onChange={(e) => setGoodFaith(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>{t('report.goodFaith')}</span>
      </label>
      {err('goodFaith')}

      {!mail.mailto && <div className="error-msg">{t('report.noRecipient')}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a
          className="btn"
          href={mail.mailto || '#report-form'}
          onClick={openMail}
          aria-disabled={!mail.mailto}
        >
          {t('report.openMail')}
        </a>
        <button className="btn ghost" type="button" onClick={copyText}>
          {copied ? t('report.copied') : t('report.copy')}
        </button>
      </div>
      <p className="notice" style={{ marginTop: 10 }}>{t('report.hint')}</p>
    </form>
  )
}
