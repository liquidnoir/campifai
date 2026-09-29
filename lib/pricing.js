// Prisregler for betaling med kort ("betal hvad du vil", i EUR).
// Beløbene her er standardværdier — ret dem frit.
export const CURRENCY = 'eur'

export const PRICING = {
  release: { minEur: 2, suggestedEur: 5 },
  collection: { minEur: 5, suggestedEur: 15 },
}

// Øvre grænse, så en tastefejl (fx 5000 i stedet for 50) ikke kan gennemføres ved en fejl.
export const MAX_EUR = 500

// Læser et beløb, som brugeren har tastet ("5", "5,50", "5.5"), og returnerer
// { ok, cents }. Afviser alt uden for min/maks samt mere end to decimaler.
export function parseAmountToCents(input, scope) {
  const rules = PRICING[scope]
  if (!rules) return { ok: false, cents: 0 }
  const raw = String(input ?? '').trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { ok: false, cents: 0 }
  const cents = Math.round(parseFloat(raw) * 100)
  if (!Number.isFinite(cents)) return { ok: false, cents: 0 }
  if (cents < rules.minEur * 100 || cents > MAX_EUR * 100) return { ok: false, cents }
  return { ok: true, cents }
}
