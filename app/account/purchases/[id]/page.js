'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { useLanguage } from '../../../../components/LanguageProvider'
import { SITE, missingSiteInfo } from '../../../../lib/siteInfo'
import { siteValues } from '../../../../lib/legalHelpers'
import { collectionTitle } from '../../../../lib/collections'
import { formatAmount, formatDateTime } from '../../../../lib/purchasesFormat'

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div className="notice" style={{ width: 120, flexShrink: 0 }}>{label}</div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  )
}

// Kvittering for én betaling. Kan udskrives eller gemmes som PDF fra browseren.
export default function ReceiptPage() {
  const { t, lang } = useLanguage()
  const { id } = useParams()
  const [receipt, setReceipt] = useState(undefined) // undefined = henter, null = findes ikke
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    supabase.rpc('my_receipt', { p_payment_id: id }).then(({ data, error: rpcError }) => {
      if (!active) return
      if (rpcError) setError(rpcError.message)
      else setReceipt(data)
    })
    return () => {
      active = false
    }
  }, [id])

  const back = (
    <p className="no-print" style={{ marginBottom: 8 }}>
      <Link href="/account/purchases">← {t('receipt.back')}</Link>
    </p>
  )

  if (error) {
    return (
      <section>
        {back}
        <div className="error-msg">{t('purchases.error', { message: error })}</div>
      </section>
    )
  }
  if (receipt === undefined) return <p className="notice">{t('common.loading')}</p>
  if (receipt === null) {
    return (
      <section>
        {back}
        <p className="notice">{t('receipt.notFound')}</p>
      </section>
    )
  }

  const values = siteValues(lang)
  const itemTitle =
    receipt.scope === 'collection'
      ? collectionTitle({ title: receipt.collectionTitle, season: receipt.season, year: receipt.year }, t)
      : receipt.releaseTitle
  const missing = missingSiteInfo()

  return (
    <section style={{ maxWidth: 640 }}>
      {back}
      <div className="panel receipt" style={{ padding: 24 }}>
        <h2>{t('receipt.title')}</h2>
        <p className="notice" style={{ marginTop: 4, marginBottom: 16 }}>
          {t('receipt.reference', { reference: receipt.reference })}
        </p>

        <Row label={t('receipt.date')}>{formatDateTime(receipt.createdAt, lang)}</Row>
        <Row label={t('receipt.item')}>
          {itemTitle}
          {receipt.scope === 'collection' ? (
            <div className="notice">{t('receipt.collection')}</div>
          ) : (
            receipt.artist && <div className="notice">{receipt.artist}</div>
          )}
        </Row>
        <Row label={t('receipt.amount')}>
          <strong>
            {formatAmount(receipt.amountCents, lang)} {String(receipt.currency || 'eur').toUpperCase()}
          </strong>
        </Row>
        <Row label={t('receipt.method')}>{t('receipt.methodValue')}</Row>
        <Row label={t('receipt.buyer')}>
          {receipt.buyerName}
          {receipt.buyerEmail && <div className="notice">{receipt.buyerEmail}</div>}
        </Row>
        <Row label={t('receipt.seller')}>
          {values.operatorBlock}
          <div className="notice">{values.email}</div>
        </Row>

        {SITE.vatNote && <p style={{ marginTop: 14, fontSize: 14 }}>{SITE.vatNote}</p>}
        <p className="notice" style={{ marginTop: 14 }}>{t('receipt.delivery')}</p>
        {missing.length > 0 && (
          <p className="notice no-print" style={{ marginTop: 10 }}>
            {t('legal.setupWarning', { fields: missing.join(', ') })}
          </p>
        )}
      </div>

      <p className="no-print" style={{ marginTop: 16 }}>
        <button className="btn" type="button" onClick={() => window.print()}>
          {t('receipt.print')}
        </button>
      </p>
    </section>
  )
}
