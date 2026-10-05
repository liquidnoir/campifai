import { collectionTitle } from './collections'

// Visning af "Mine køb" og kvitteringer.

function locale(lang) {
  return lang === 'en' ? 'en-GB' : 'da-DK'
}

// 250 → "2,50" (dansk) / "2.50" (engelsk)
export function formatAmount(cents, lang = 'da') {
  return (Number(cents || 0) / 100).toLocaleString(locale(lang), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// "4. oktober 2026" (kun dato) i dansk tid
export function formatDate(iso, lang = 'da') {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(locale(lang), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Copenhagen',
  })
}

// "4. oktober 2026 kl. 11.43" (dato og klokkeslæt) i dansk tid
export function formatDateTime(iso, lang = 'da') {
  if (!iso) return ''
  return new Date(iso).toLocaleString(locale(lang), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Copenhagen',
  })
}

// Navnet på det, der er købt (udgivelse eller kollektion)
export function purchaseTitle(row, t) {
  if (row.scope === 'collection') {
    if (row.season && row.year) {
      return collectionTitle({ title: row.collectionTitle, season: row.season, year: row.year }, t)
    }
    return row.collectionTitle || t('purchases.unavailable')
  }
  return row.releaseTitle || t('purchases.unavailable')
}

// Hvor man henter varen igen. Null, hvis den ikke længere er tilgængelig.
export function purchaseHref(row) {
  if (row.scope === 'collection') {
    return row.collectionId && row.collectionEnabled !== false ? `/collections/${row.collectionId}` : null
  }
  return row.releaseId ? `/release/${row.releaseId}` : null
}

// Hvordan købet skete: betalt, gratis eller donation
export function methodText(row, t, lang = 'da') {
  if (row.method === 'stripe') {
    return row.amountCents > 0
      ? t('purchases.paid', { amount: formatAmount(row.amountCents, lang) })
      : t('purchases.free')
  }
  if (row.method === 'donation_ecf') return t('purchases.donationEcf')
  if (row.method === 'donation_sweet_relief') return t('purchases.donationSweetRelief')
  return t('purchases.other')
}

// Kan der vises en kvittering? Kun for rigtige betalinger.
export function hasReceipt(row) {
  return Boolean(row.paymentId) && row.amountCents > 0
}

// Samlet betalt beløb i EUR (gratis og donationer tæller ikke med)
export function totalPaidCents(rows) {
  return rows
    .filter((row) => row.amountCents > 0 && String(row.currency || '').toLowerCase() === 'eur')
    .reduce((sum, row) => sum + row.amountCents, 0)
}

// Antal betalinger i en anden valuta end EUR (indgår ikke i totalen)
export function otherCurrencyCount(rows) {
  return rows.filter((row) => row.amountCents > 0 && String(row.currency || '').toLowerCase() !== 'eur').length
}
