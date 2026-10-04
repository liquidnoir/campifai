import { SITE, operatorBlock } from './siteInfo'

// Værdier, der sættes ind i de juridiske tekster. Mangler en oplysning, vises en tydelig [pladsholder].
export function siteValues(lang = 'da', site = SITE) {
  const en = lang === 'en'
  return {
    name: site.name,
    operatorBlock: operatorBlock(site, en ? '[operator]' : '[ansvarlig]'),
    email: String(site.email || '').trim() || (en ? '[contact email]' : '[kontakt-e-mail]'),
    siteUrl: site.siteUrl,
  }
}

// "2026-10-05" → "5. oktober 2026" / "5 October 2026"
export function formatLegalDate(iso, lang = 'da') {
  if (!iso) return ''
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'da-DK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Copenhagen',
  })
}

const MAX_REASON_LENGTH = 1500

// En enkel kontrol af en e-mailadresse (kun for at fange tastefejl)
export function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim())
}

// Kontrollerer en anmeldelse af indhold. Returnerer en liste af fejl-koder (tom = i orden):
// "url" | "reason" | "name" | "email" | "goodFaith"
export function validateReport({ url, reason, name, email, goodFaith }) {
  const errors = []
  if (!String(url || '').trim()) errors.push('url')
  if (String(reason || '').trim().length < 20) errors.push('reason')
  if (!String(name || '').trim()) errors.push('name')
  if (!looksLikeEmail(email)) errors.push('email')
  if (!goodFaith) errors.push('goodFaith')
  return errors
}

// Sætter en anmeldelse sammen til en e-mail, som brugeren kan sende. Indeholder de fire
// ting, en anmeldelse skal have: adresse, begrundelse, navn og e-mail, og god tro-erklæring.
// Returnerer { to, subject, body, mailto } — mailto er null, hvis der ikke er en modtager.
export function buildReportMail({ to, url, reason, name, email, lang = 'da' }) {
  const en = lang === 'en'
  const cleanReason = String(reason || '').trim().slice(0, MAX_REASON_LENGTH)
  const subject = `${en ? 'Report of content' : 'Anmeldelse af indhold'}: ${String(url || '').trim()}`
  const lines = en
    ? [
        'Report of content (Digital Services Act, notice and action)',
        '',
        `Location (URL): ${String(url || '').trim()}`,
        '',
        'Explanation of why the content is unlawful or infringing:',
        cleanReason,
        '',
        `Name: ${String(name || '').trim()}`,
        `Email: ${String(email || '').trim()}`,
        '',
        'I confirm that I believe in good faith that the information and allegations in this report are accurate and complete.',
      ]
    : [
        'Anmeldelse af indhold (Digital Services Act, notice and action)',
        '',
        `Placering (URL): ${String(url || '').trim()}`,
        '',
        'Begrundelse for, hvorfor indholdet er ulovligt eller krænkende:',
        cleanReason,
        '',
        `Navn: ${String(name || '').trim()}`,
        `E-mail: ${String(email || '').trim()}`,
        '',
        'Jeg bekræfter, at jeg i god tro mener, at oplysningerne og påstandene i denne anmeldelse er korrekte og fuldstændige.',
      ]
  const body = lines.join('\n')
  const recipient = String(to || '').trim()
  const mailto = recipient
    ? `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null
  return { to: recipient, subject, body, mailto }
}
