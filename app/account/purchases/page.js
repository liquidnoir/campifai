'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import { imagePublicUrl } from '../../../lib/shared'
import { useLanguage } from '../../../components/LanguageProvider'
import {
  formatAmount,
  formatDate,
  hasReceipt,
  methodText,
  otherCurrencyCount,
  purchaseHref,
  purchaseTitle,
  totalPaidCents,
} from '../../../lib/purchasesFormat'

function Cover({ url, color = '#B8452B' }) {
  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 8,
        flexShrink: 0,
        background: url ? undefined : color,
        backgroundImage: url ? `url(${url})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
  )
}

export default function MyPurchasesPage() {
  const { t, lang } = useLanguage()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    supabase.rpc('my_purchases').then(({ data, error: rpcError }) => {
      if (!active) return
      if (rpcError) {
        setError(rpcError.message)
        return
      }
      setRows(data || [])
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <section style={{ maxWidth: 720 }}>
      <p style={{ marginBottom: 8 }}>
        <Link href="/account">← {t('nav.account')}</Link>
      </p>
      <h2>{t('purchases.title')}</h2>
      <p className="notice" style={{ marginTop: 8 }}>{t('purchases.intro')}</p>

      {error && <div className="error-msg" style={{ marginTop: 16 }}>{t('purchases.error', { message: error })}</div>}
      {!rows && !error && <p className="notice" style={{ marginTop: 20 }}>{t('common.loading')}</p>}

      {rows && rows.length === 0 && (
        <div className="panel" style={{ marginTop: 20 }}>
          <p>{t('purchases.empty')}</p>
          <p style={{ marginTop: 12 }}>
            <Link href="/" className="btn">{t('purchases.browse')}</Link>
          </p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <>
          <p className="notice" style={{ marginTop: 16, marginBottom: 12 }}>
            {t('purchases.summary', { count: rows.length, total: formatAmount(totalPaidCents(rows), lang) })}
          </p>
          {otherCurrencyCount(rows) > 0 && (
            <p className="notice" style={{ marginBottom: 12 }}>
              {t('purchases.otherCurrency', { count: otherCurrencyCount(rows) })}
            </p>
          )}

          {rows.map((row) => {
            const href = purchaseHref(row)
            const isCollection = row.scope === 'collection'
            const cover = imagePublicUrl(supabase, isCollection ? row.collectionCover : row.releaseCover)
            return (
              <div className="panel" key={row.purchaseId} style={{ padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Cover url={cover} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>
                      {href ? <Link href={href}>{purchaseTitle(row, t)}</Link> : purchaseTitle(row, t)}
                    </div>
                    <div className="notice">
                      {isCollection
                        ? t(row.releaseCount === 1 ? 'purchases.collection_one' : 'purchases.collection_other', { count: row.releaseCount })
                        : `${row.artist || t('home.unknownArtist')} · ${t(`type.${row.releaseType}`)}`}
                    </div>
                  </div>
                </div>
                <div className="notice" style={{ marginTop: 10 }}>
                  {formatDate(row.createdAt, lang)} · {methodText(row, t, lang)}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {href ? (
                    <Link href={href} className="btn">{t('purchases.open')}</Link>
                  ) : (
                    <span className="notice">{t('purchases.unavailableNote')}</span>
                  )}
                  {hasReceipt(row) && (
                    <Link href={`/account/purchases/${row.paymentId}`} className="btn ghost">
                      {t('purchases.receipt')}
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </>
      )}
    </section>
  )
}
