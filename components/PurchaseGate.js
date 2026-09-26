'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { DONATION_OPTIONS, recordPurchase } from '../lib/purchases'
import { useLanguage } from './LanguageProvider'

// hasAccess: bool | null (null = tjekker stadig)
// onGranted: kaldes efter et gennemført "køb", så forælderen kan opdatere adgangen
export default function PurchaseGate({ scope, releaseId, collectionId, itemLabel, hasAccess, onGranted }) {
  const { t } = useLanguage()
  const [busyKey, setBusyKey] = useState('')
  const [error, setError] = useState('')

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

  if (hasAccess === null) return <p className="notice">{t('common.loading')}</p>
  if (hasAccess) return null

  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <p className="notice" style={{ marginBottom: 12 }}>
        {t('purchase.supportPrompt', { item: itemLabel })}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {DONATION_OPTIONS.map((o) => (
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
        <button className="btn ghost" type="button" disabled title={t('purchase.comingSoon')}>
          {t('purchase.payByCard')}
        </button>
      </div>
      {error && <div className="error-msg">{error}</div>}
    </div>
  )
}
