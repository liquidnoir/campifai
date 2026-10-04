import { collectionTitle } from './collections'

// Visning af tal og navne i statistik-siderne.

function locale(lang) {
  return lang === 'en' ? 'en-GB' : 'da-DK'
}

export function formatInt(n, lang = 'da') {
  return Number(n || 0).toLocaleString(locale(lang))
}

// 750 → "7,50" (altid to decimaler, så beløb står pænt under hinanden)
export function formatMoney(cents, lang = 'da') {
  return (Number(cents || 0) / 100).toLocaleString(locale(lang), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Dato og klokkeslæt i dansk tid, fx "4. okt. 11:43"
export function formatDateTime(iso, lang = 'da') {
  if (!iso) return ''
  return new Date(iso).toLocaleString(locale(lang), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Copenhagen',
  })
}

// "2026-10-04" → "4. okt."
export function formatDay(day, lang = 'da') {
  if (!day) return ''
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(locale(lang), {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Copenhagen',
  })
}

// Navnet på en vare (udgivelse eller kollektion) i en række fra statistikken.
// Er varen slettet, bruges den titel, der blev gemt, da oplåsningen skete.
export function itemLabel(row, t) {
  if (row.scope === 'collection') {
    if (row.season && row.year) {
      return collectionTitle({ title: row.collectionTitle, season: row.season, year: row.year }, t)
    }
    return row.fallbackTitle || t('stats.deletedItem')
  }
  return row.releaseTitle || row.fallbackTitle || t('stats.deletedItem')
}

// Hvordan en oplåsning skete: betalt, gratis (0) eller en donation
export function methodLabel(row, t) {
  if (row.method === 'stripe') {
    return row.amountCents > 0 ? t('stats.method.paid') : t('stats.method.free')
  }
  if (row.method === 'donation_ecf') return t('stats.method.donation_ecf')
  if (row.method === 'donation_sweet_relief') return t('stats.method.donation_sweet_relief')
  return t('stats.method.unknown')
}

// Beløbet ud for en oplåsning ("2,50 EUR"), og intet ved donationer (beløb ukendt)
export function amountLabel(row, lang = 'da') {
  if (row.amountCents === null || row.amountCents === undefined) return ''
  return `${formatMoney(row.amountCents, lang)} ${String(row.currency || 'eur').toUpperCase()}`
}

// Største værdi i en række (mindst 1, så søjler aldrig deles med nul)
export function maxOf(rows, field) {
  return Math.max(1, ...rows.map((row) => Number(row[field] || 0)))
}

// Perioden som den bruges i linket mellem siderne: ?days=30&own=1 (days=all for "i alt")
export function periodToQuery(days, includeOwn) {
  return `?days=${days === null ? 'all' : days}&own=${includeOwn ? 1 : 0}`
}

export function periodFromQuery(search, fallbackDays = 30) {
  const params = new URLSearchParams(search || '')
  const raw = params.get('days')
  let days = fallbackDays
  if (raw === 'all') days = null
  else if (['7', '30', '90'].includes(raw)) days = Number(raw)
  return { days, includeOwn: params.get('own') === '1' }
}
