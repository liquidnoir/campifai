// Prisregler for betaling med kort ("betal hvad du vil", i EUR).
// For en udgivelse afhænger minimumsbeløbet af typen (single/EP/album).
export const CURRENCY = 'eur'

export const PRICING = {
  release: {
    single: { minEur: 1, suggestedEur: 2 },
    ep: { minEur: 4, suggestedEur: 6 },
    album: { minEur: 6, suggestedEur: 10 },
  },
  collection: { minEur: 5, suggestedEur: 15 },
}

// Øvre grænse, så en tastefejl (fx 5000 i stedet for 50) ikke kan gennemføres ved en fejl.
export const MAX_EUR = 500

// Finder de gældende prisregler. For "release" SKAL releaseType være en af
// nøglerne i PRICING.release (single/ep/album) — kald altid denne med en
// værdi, serveren selv har slået op i databasen, aldrig med noget fra klienten.
export function getPricingRules(scope, releaseType) {
  if (scope === 'collection') return PRICING.collection
  if (scope === 'release') return PRICING.release[releaseType] || null
  return null
}

// Læser et beløb, som brugeren har tastet ("5", "5,50", "5.5"), og returnerer
// { ok, cents }. Afviser alt uden for min/maks samt mere end to decimaler.
export function parseAmountToCents(input, scope, releaseType) {
  const rules = getPricingRules(scope, releaseType)
  if (!rules) return { ok: false, cents: 0 }
  const raw = String(input ?? '').trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { ok: false, cents: 0 }
  const cents = Math.round(parseFloat(raw) * 100)
  if (!Number.isFinite(cents)) return { ok: false, cents: 0 }
  if (cents < rules.minEur * 100 || cents > MAX_EUR * 100) return { ok: false, cents }
  return { ok: true, cents }
}
