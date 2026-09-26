'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { DONATION_OPTIONS, recordPurchase } from '../lib/purchases'

// hasAccess: bool | null (null = tjekker stadig)
// onGranted: kaldes efter et gennemført "køb", så forælderen kan opdatere adgangen
export default function PurchaseGate({ scope, releaseId, collectionId, itemLabel, hasAccess, onGranted }) {
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
      setError('Kunne ikke låse op. Prøv igen.')
      return
    }
    onGranted?.()
  }

  if (hasAccess === null) return <p className="notice">Henter...</p>
  if (hasAccess) return null

  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <p className="notice" style={{ marginBottom: 12 }}>
        Støt uafhængige musikere for at låse download op af {itemLabel}:
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
            {busyKey === o.key ? 'Åbner...' : o.label}
          </button>
        ))}
        <button className="btn ghost" type="button" disabled title="Kommer snart">
          Betal med kort (kommer snart)
        </button>
      </div>
      {error && <div className="error-msg">{error}</div>}
    </div>
  )
}
