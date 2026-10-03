'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DONATION_OPTIONS, recordPurchase } from '../lib/purchases'
import { centsToInput, formatEur, getPricingRules, parseAmountToCents } from '../lib/pricing'
import { getAppSettings } from '../lib/appSettings'
import { useLanguage } from './LanguageProvider'

// hasAccess: bool | null (null = tjekker stadig)
// releaseType: KUN relevant når scope === 'release' — skal være den ægte type
//   (single/ep/album) fra databasen, da den styrer minimums- og forslagsprisen.
// priceOverrides: udgivelsen selv (med publisherens egne priser, hvis de er sat); bruges kun for scope "release"
// onGranted: kaldes efter et gennemført donations-"køb", så forælderen kan opdatere adgangen
export default function PurchaseGate({ scope, releaseId, collectionId, releaseType, priceOverrides, hasAccess, onGranted }) {
  const { t, lang } = useLanguage()
  const rules = getPricingRules(scope, releaseType, priceOverrides)
  const [settings, setSettings] = useState(null) // null = henter stadig
  const [busyKey, setBusyKey] = useState('')
  const [error, setError] = useState('')
  const [cardOpen, setCardOpen] = useState(false)
  const [amount, setAmount] = useState(rules ? centsToInput(rules.suggestedCents, lang) : '')
  const [cardBusy, setCardBusy] = useState(false)

  useEffect(() => {
    getAppSettings(supabase).then(setSettings)
  }, [])

  // Kommer man tilbage til siden med "tilbage"-knappen fra Stripe, skal knappen ikke sidde fast
  useEffect(() => {
    function handlePageShow(event) {
      if (event.persisted) setCardBusy(false)
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  async function handleDonate(option) {
    setBusyKey(option.key)
    setError('')
    window.open(option.url, '_blank', 'noopener,noreferrer')
    const insertError = await recordPurchase(supabase, {
      scope,
      releaseId,
      collectionId,
      method: option.key,
    })
    setBusyKey('')
    if (insertError) {
      setError(t('purchase.unlockFailed'))
      return
    }
    onGranted?.()
  }

  // Fejltekst, der passer til reglerne: "0 er gratis" kun hvis mindsteprisen er 0
  function invalidAmountMessage() {
    if (!rules) return t('purchase.card.failed')
    return rules.minCents === 0
      ? t('purchase.card.invalidAmount', { max: formatEur(rules.maxCents, lang) })
      : t('purchase.card.invalidAmountMin', {
          min: formatEur(rules.minCents, lang),
          max: formatEur(rules.maxCents, lang),
        })
  }

  async function handleCard(event) {
    event.preventDefault()
    setError('')
    const parsed = parseAmountToCents(amount, scope, releaseType, priceOverrides)
    if (!parsed.ok || !rules) {
      setError(invalidAmountMessage())
      return
    }
    setCardBusy(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scope, releaseId, collectionId, amount }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.url) {
        setError(
          body.error === 'amount_invalid'
            ? invalidAmountMessage()
            : body.error === 'purchases_disabled'
              ? t('purchase.card.disabled')
              : t('purchase.card.failed')
        )
        setCardBusy(false)
        return
      }
      window.location.href = body.url
    } catch {
      setError(t('purchase.card.failed'))
      setCardBusy(false)
    }
  }

  if (hasAccess === null || settings === null) return <p className="notice">{t('common.loading')}</p>
  if (hasAccess) return null

  const { purchasesEnabled, donationsEnabled } = settings

  if (!purchasesEnabled && !donationsEnabled) {
    return (
      <div className="panel" style={{ marginBottom: 20 }}>
        <p className="notice" style={{ margin: 0 }}>{t('purchase.unavailable')}</p>
      </div>
    )
  }

  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <p className="notice" style={{ marginBottom: 12 }}>
        {t('purchase.supportPrompt')}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {donationsEnabled &&
          DONATION_OPTIONS.map((o) => (
            <button
              key={o.key}
              className="btn ghost"
              type="button"
              disabled={busyKey === o.key}
              onClick={() => handleDonate(o)}
            >
              {busyKey === o.key ? t('purchase.opening') : t(`purchase.donation.${o.key}`)}
            </button>
          ))}
        {purchasesEnabled && (
          <button className="btn ghost" type="button" onClick={() => setCardOpen((open) => !open)}>
            {scope === 'collection' ? t('purchase.buyCollection') : t('purchase.payByCard')}
          </button>
        )}
      </div>

      {purchasesEnabled && cardOpen && rules && (
        <form onSubmit={handleCard} style={{ marginTop: 16 }}>
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor={`amount-${scope}`}>
              {rules.minCents === 0
                ? t('purchase.card.amountLabel')
                : t('purchase.card.amountLabelMin', {
                    min: formatEur(rules.minCents, lang),
                    max: formatEur(rules.maxCents, lang),
                  })}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id={`amount-${scope}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={cardBusy}
                style={{ flex: 1, minWidth: 0 }}
              />
              <span className="notice" style={{ margin: 0 }}>EUR</span>
            </div>
          </div>
          <button className="btn" type="submit" disabled={cardBusy}>
            {cardBusy ? t('purchase.card.redirecting') : t('purchase.card.continue')}
          </button>
          <p className="notice" style={{ marginTop: 8 }}>{t('purchase.card.secureNote')}</p>
        </form>
      )}

      {error && <div className="error-msg">{error}</div>}
    </div>
  )
}
