// Prisregler for betaling med kort ("betal hvad du vil", i EUR).
//
// Midlertidig sikkerhedsindstilling under produktionsafprøvning: minimum er 0 (gratis)
// for alt, og maksimum er kun 2 EUR over det foreslåede beløb. Ret suggestedEur og
// maxOverSuggestedEur, når afprøvningsperioden er slut.
export const CURRENCY = 'eur'

const MAX_OVER_SUGGESTED_EUR = 2

export const PRICING = {
  release: {
    single: { suggestedEur: 1 },
    ep: { suggestedEur: 2 },
    album: { suggestedEur: 4 },
  },
  collection: { suggestedEur: 8 },
}

// Stripe afviser ethvert IKKE-nul beløb under grænsen for valutaen (0,50 EUR) — en pris
// mellem 0,01 og 0,49 ville blive accepteret af os, men afvist af Stripe selv. 0 er til
// gengæld altid tilladt: en Checkout-session på 0 kræver ikke kort og gennemføres straks.
const STRIPE_MIN_NONZERO_EUR = 0.5

function getRules(scope, releaseType) {
  const base = scope === 'collection' ? PRICING.collection : scope === 'release' ? PRICING.release[releaseType] : null
  if (!base) return null
  return { minEur: 0, suggestedEur: base.suggestedEur, maxEur: base.suggestedEur + MAX_OVER_SUGGESTED_EUR }
}

export const getPricingRules = getRules

// Læser et beløb, som brugeren har tastet ("0", "5", "5,50"), og returnerer { ok, cents }.
// releaseType er KUN relevant for scope "release" og skal altid komme fra serverens egen
// opslag i databasen, aldrig fra klienten.
export function parseAmountToCents(input, scope, releaseType) {
  const rules = getRules(scope, releaseType)
  if (!rules) return { ok: false, cents: 0 }
  const raw = String(input ?? '').trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { ok: false, cents: 0 }
  const cents = Math.round(parseFloat(raw) * 100)
  if (!Number.isFinite(cents)) return { ok: false, cents: 0 }
  if (cents === 0) return { ok: true, cents: 0 }
  if (cents < STRIPE_MIN_NONZERO_EUR * 100) return { ok: false, cents }
  if (cents > rules.maxEur * 100) return { ok: false, cents }
  return { ok: true, cents }
}
