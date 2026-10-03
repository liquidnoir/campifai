// Prisregler for betaling med kort ("betal hvad du vil", i EUR). Alle beløb regnes i hele cents.
//
// En udgivelse kan have sine egne priser (price_min_cents, price_suggested_cents og
// price_max_cents), som publisheren selv sætter. Er de tomme, bruges standardprisen for
// udgivelsens type nedenfor. Kollektioner bruger altid standardprisen.
export const CURRENCY = 'eur'

// Standardpriser. Midlertidig sikkerhedsindstilling: mindsteprisen er 0 (gratis adgang),
// og maksimum er kun 2 EUR over den foreslåede pris.
const DEFAULT_SUGGESTED_CENTS = { single: 100, ep: 200, album: 400 }
const COLLECTION_SUGGESTED_CENTS = 800
const DEFAULT_MAX_OVER_SUGGESTED_CENTS = 200

// Stripe afviser ethvert beløb over 0 under 0,50 EUR. 0 er altid tilladt (en Checkout-session
// på 0 kræver ikke kort). Maks 500 EUR er en fast sikkerhedsgrænse på tværs af alle priser.
export const STRIPE_MIN_NONZERO_CENTS = 50
export const MAX_PRICE_CENTS = 50000

export function defaultRulesCents(scope, releaseType) {
  const suggested =
    scope === 'collection' ? COLLECTION_SUGGESTED_CENTS : scope === 'release' ? DEFAULT_SUGGESTED_CENTS[releaseType] : undefined
  if (suggested === undefined) return null
  return {
    minCents: 0,
    suggestedCents: suggested,
    maxCents: suggested + DEFAULT_MAX_OVER_SUGGESTED_CENTS,
    isCustom: false,
  }
}

// Udgivelsens egne priser, hvis de er sat og hænger sammen — ellers null.
// (Databasen tillader kun gyldige sæt, men serveren stoler ikke blindt på det.)
function customRulesFrom(source) {
  if (!source) return null
  const min = source.price_min_cents
  const suggested = source.price_suggested_cents
  const max = source.price_max_cents
  if (![min, suggested, max].every((n) => Number.isInteger(n))) return null
  if (!(min >= 0 && min <= suggested && suggested <= max)) return null
  if (max < STRIPE_MIN_NONZERO_CENTS || max > MAX_PRICE_CENTS) return null
  if (min !== 0 && min < STRIPE_MIN_NONZERO_CENTS) return null
  if (suggested !== 0 && suggested < STRIPE_MIN_NONZERO_CENTS) return null
  return { minCents: min, suggestedCents: suggested, maxCents: max, isCustom: true }
}

// De gældende regler. For en udgivelse: dens egne priser, ellers standarden for typen.
// release og releaseType skal for serverens vedkommende komme fra serverens eget opslag i
// databasen, aldrig fra klienten.
export function getPricingRules(scope, releaseType, release) {
  if (scope === 'release') {
    const custom = customRulesFrom(release)
    if (custom) return custom
  }
  return defaultRulesCents(scope, releaseType)
}

// Læser et beløb, som brugeren har tastet ("0", "5", "5,50"), og returnerer { ok, cents }.
export function parseAmountToCents(input, scope, releaseType, release) {
  const rules = getPricingRules(scope, releaseType, release)
  if (!rules) return { ok: false, cents: 0 }
  const cents = parseEurToCents(input)
  if (cents === null) return { ok: false, cents: 0 }
  if (cents === 0) return rules.minCents === 0 ? { ok: true, cents: 0 } : { ok: false, cents: 0 }
  if (cents < STRIPE_MIN_NONZERO_CENTS) return { ok: false, cents }
  if (cents < rules.minCents || cents > rules.maxCents) return { ok: false, cents }
  return { ok: true, cents }
}

// ---------- Hjælpere til visning og indtastning af priser ----------

// "2", "2,5" eller "2.50" → hele cents, eller null hvis det ikke er et gyldigt beløb
export function parseEurToCents(input) {
  const raw = String(input ?? '').trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null
  const cents = Math.round(parseFloat(raw) * 100)
  return Number.isFinite(cents) ? cents : null
}

function locale(lang) {
  return lang === 'en' ? 'en-GB' : 'da-DK'
}

// Til visning i tekst: 250 → "2,5" (dansk) / "2.5" (engelsk)
export function formatEur(cents, lang = 'da') {
  return (cents / 100).toLocaleString(locale(lang), { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

// Til inputfelter (uden tusindtalsseparator)
export function centsToInput(cents, lang = 'da') {
  return (cents / 100).toLocaleString(locale(lang), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: false,
  })
}

// Kontrollerer de tre felter i publisherens formular (tekst i EUR).
// Returnerer { ok: true, cents: { min, suggested, max } } eller { ok: false, error }
// hvor error er en af: "invalid" | "floor" | "max" | "order".
export function validatePriceSettings({ min, suggested, max }) {
  const a = parseEurToCents(min)
  const b = parseEurToCents(suggested)
  const c = parseEurToCents(max)
  if (a === null || b === null || c === null) return { ok: false, error: 'invalid' }
  if ((a !== 0 && a < STRIPE_MIN_NONZERO_CENTS) || (b !== 0 && b < STRIPE_MIN_NONZERO_CENTS)) {
    return { ok: false, error: 'floor' }
  }
  if (c < STRIPE_MIN_NONZERO_CENTS || c > MAX_PRICE_CENTS) return { ok: false, error: 'max' }
  if (!(a <= b && b <= c)) return { ok: false, error: 'order' }
  return { ok: true, cents: { min: a, suggested: b, max: c } }
}

// Kolonner til at gemme i databasen (null = brug standardprisen)
export function priceColumns(cents) {
  if (!cents) return { price_min_cents: null, price_suggested_cents: null, price_max_cents: null }
  return { price_min_cents: cents.min, price_suggested_cents: cents.suggested, price_max_cents: cents.max }
}

// Startværdier til formularen ud fra en udgivelse (eller en ny, tom udgivelse)
export function priceFormFromRelease(release, lang = 'da') {
  const custom = customRulesFrom(release)
  if (!custom) return { custom: false, min: '', suggested: '', max: '' }
  return {
    custom: true,
    min: centsToInput(custom.minCents, lang),
    suggested: centsToInput(custom.suggestedCents, lang),
    max: centsToInput(custom.maxCents, lang),
  }
}
