'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { useLanguage } from '../../../components/LanguageProvider'
import { KpiCard, MiniBars, PeriodControls, Stat } from '../../../components/StatsParts'
import {
  amountLabel,
  formatDateTime,
  formatInt,
  formatMoney,
  itemLabel,
  maxOf,
  methodLabel,
  periodFromQuery,
  periodToQuery,
} from '../../../lib/statsFormat'

const SECTION = { marginTop: 32 }

export default function AdminStatsPage() {
  const { t, lang } = useLanguage()
  const router = useRouter()
  const [session, setSession] = useState(undefined)
  const [me, setMe] = useState(null)
  const [checked, setChecked] = useState(false)
  const [days, setDays] = useState(30)
  const [includeOwn, setIncludeOwn] = useState(false)
  const [ready, setReady] = useState(false) // perioden er læst fra adressen
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestRef = useRef(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: s }) => setSession(s.session))
    const period = periodFromQuery(window.location.search)
    setDays(period.days)
    setIncludeOwn(period.includeOwn)
    setReady(true)
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (session === null) {
      router.replace('/login')
      return
    }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data: profile }) => {
        setMe(profile || null)
        setChecked(true)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  useEffect(() => {
    if (!ready || me?.role !== 'admin') return
    window.history.replaceState(null, '', window.location.pathname + periodToQuery(days, includeOwn))
    requestRef.current += 1
    setLoading(true)
    load(requestRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, me, days, includeOwn])

  async function load(requestId) {
    const args = { p_days: days, p_include_own: includeOwn }
    const [overview, releases, daily] = await Promise.all([
      supabase.rpc('admin_stats_overview', args),
      supabase.rpc('admin_stats_releases', args),
      supabase.rpc('admin_stats_daily', { p_days: days ?? 90, p_include_own: includeOwn }),
    ])
    if (requestId !== requestRef.current) return // et nyere valg er allerede på vej
    const failed = overview.error || releases.error || daily.error
    if (failed) {
      setError(failed.message)
      setData(null)
    } else {
      setError('')
      setData({ overview: overview.data, releases: releases.data || [], daily: daily.data || [] })
    }
    setLoading(false)
  }

  if (session === undefined || !checked) return <p className="notice">{t('common.loading')}</p>
  if (me?.role !== 'admin') {
    return (
      <section>
        <h2>{t('stats.title')}</h2>
        <p className="notice" style={{ marginTop: 12 }}>{t('admin.noAccess')}</p>
      </section>
    )
  }

  const o = data?.overview
  const bucketLabels = {
    free: t('stats.bucket.free'),
    '0.5-0.99': t('stats.bucket.b1'),
    '1-1.99': t('stats.bucket.b2'),
    '2-4.99': t('stats.bucket.b3'),
    '5-9.99': t('stats.bucket.b4'),
    '10+': t('stats.bucket.b5'),
  }
  const query = periodToQuery(days, includeOwn)

  return (
    <section>
      <p style={{ marginBottom: 8 }}>
        <Link href="/admin">← {t('nav.admin')}</Link>
      </p>
      <h2>{t('stats.title')}</h2>
      <p className="notice" style={{ marginTop: 8 }}>{t('stats.intro')}</p>
      <PeriodControls
        days={days}
        includeOwn={includeOwn}
        onDays={setDays}
        onOwn={setIncludeOwn}
        disabled={loading}
      />

      {error && <div className="error-msg" style={{ marginTop: 16 }}>{t('stats.error', { message: error })}</div>}
      {!data && !error && <p className="notice" style={{ marginTop: 24 }}>{t('common.loading')}</p>}

      {o && (
        <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
          {o.eventsSince && (
            <p className="notice" style={{ marginTop: 16 }}>
              {t('stats.eventsNote', { date: formatDateTime(o.eventsSince, lang) })}
            </p>
          )}

          {/* ---------- Overblik ---------- */}
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginTop: 16 }}
          >
            <KpiCard
              label={t('stats.kpi.revenue')}
              value={`${formatMoney(o.kpi.revenueCents, lang)} EUR`}
              sub={t('stats.kpi.revenueSub', {
                payments: formatInt(o.kpi.payments, lang),
                avg: formatMoney(o.kpi.payments - o.kpi.otherCurrencyPayments > 0 ? o.kpi.revenueCents / (o.kpi.payments - o.kpi.otherCurrencyPayments) : 0, lang),
              })}
            />
            <KpiCard
              label={t('stats.kpi.unlocks')}
              value={formatInt(o.kpi.unlocks, lang)}
              sub={t('stats.kpi.unlocksSub', {
                paid: formatInt(o.kpi.unlocksPaid, lang),
                free: formatInt(o.kpi.unlocksFree, lang),
                donation: formatInt(o.kpi.unlocksDonation, lang),
              })}
            />
            <KpiCard
              label={t('stats.kpi.downloads')}
              value={formatInt(o.kpi.downloads, lang)}
              sub={t('stats.kpi.downloadsSub', {
                mp3: formatInt(o.kpi.downloadsMp3, lang),
                flac: formatInt(o.kpi.downloadsFlac, lang),
              })}
            />
            <KpiCard
              label={t('stats.kpi.plays')}
              value={formatInt(days === null ? o.kpi.playsTotal : o.kpi.playsPeriod, lang)}
              sub={
                days === null
                  ? t('stats.kpi.playsSubTimed', { period: formatInt(o.kpi.playsPeriod, lang) })
                  : t('stats.kpi.playsSub', { total: formatInt(o.kpi.playsTotal, lang) })
              }
            />
            <KpiCard label={t('stats.kpi.listeners')} value={formatInt(o.kpi.uniqueListeners, lang)} />
            <KpiCard
              label={t('stats.kpi.newUsers')}
              value={formatInt(o.kpi.newUsers, lang)}
              sub={
                o.kpi.pendingPublishers > 0 ? (
                  <Link href="/admin">{t('stats.kpi.pending', { count: o.kpi.pendingPublishers })}</Link>
                ) : null
              }
            />
          </div>
          {o.kpi.otherCurrencyPayments > 0 && (
            <p className="notice" style={{ marginTop: 8 }}>
              {t('stats.kpi.otherCurrency', { count: o.kpi.otherCurrencyPayments })}
            </p>
          )}

          {/* ---------- Tendens ---------- */}
          <div style={SECTION}>
            <h3 style={{ fontSize: 17, marginBottom: 12 }}>{t('stats.trend.title')}</h3>
            <MiniBars title={t('stats.trend.plays')} rows={data.daily} field="plays" />
            <MiniBars title={t('stats.trend.unlocks')} rows={data.daily} field="unlocks" />
            <MiniBars title={t('stats.trend.downloads')} rows={data.daily} field="downloads" />
          </div>

          {/* ---------- Udgivelser ---------- */}
          <div style={SECTION}>
            <h3 style={{ fontSize: 17 }}>{t('stats.releases.title')}</h3>
            <p className="notice" style={{ marginTop: 4, marginBottom: 12 }}>{t('stats.releases.hint')}</p>
            {data.releases.length === 0 && <p className="notice">{t('stats.releases.empty')}</p>}
            {data.releases.map((release) => (
              <div className="panel" key={release.releaseId} style={{ padding: 14, marginBottom: 10 }}>
                <Link href={`/admin/statistik/${release.releaseId}${query}`} style={{ fontSize: 16, fontWeight: 500 }}>
                  {release.title}
                </Link>
                <div className="notice">
                  {release.artist || t('home.unknownArtist')} · {t(`type.${release.type}`)}
                </div>
                <div
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginTop: 10 }}
                >
                  <Stat
                    label={t('stats.releases.plays')}
                    value={formatInt(days === null ? release.playsTotal : release.playsPeriod, lang)}
                    sub={
                      days === null
                        ? t('stats.releases.playsHintTimed', { period: formatInt(release.playsPeriod, lang) })
                        : t('stats.releases.playsHint', { total: formatInt(release.playsTotal, lang) })
                    }
                  />
                  <Stat
                    label={t('stats.releases.unlocks')}
                    value={formatInt(release.unlocksDirect + release.unlocksViaCollection, lang)}
                    sub={t('stats.releases.unlocksHint', {
                      direct: formatInt(release.unlocksDirect, lang),
                      viaCollection: formatInt(release.unlocksViaCollection, lang),
                    })}
                  />
                  <Stat label={t('stats.releases.revenue')} value={`${formatMoney(release.revenueCents, lang)} EUR`} />
                  <Stat
                    label={t('stats.releases.downloads')}
                    value={formatInt(release.downloadsDirect + release.downloadsViaCollection, lang)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* ---------- Salg og oplåsninger ---------- */}
          <div style={SECTION}>
            <h3 style={{ fontSize: 17, marginBottom: 12 }}>{t('stats.sales.title')}</h3>

            <div className="notice" style={{ marginBottom: 6 }}>{t('stats.sales.buckets')}</div>
            {(() => {
              const peak = maxOf(o.sales.buckets, 'count')
              return o.sales.buckets.map((bucket) => (
                <div key={bucket.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, fontSize: 14 }}>
                  <div style={{ width: 120, flexShrink: 0 }}>{bucketLabels[bucket.key]}</div>
                  <div style={{ flex: 1, background: '#2a251c', borderRadius: 2, height: 10 }}>
                    <div
                      style={{ width: `${(bucket.count / peak) * 100}%`, height: '100%', background: '#D9734F', borderRadius: 2 }}
                    />
                  </div>
                  <div style={{ width: 36, textAlign: 'right' }}>{formatInt(bucket.count, lang)}</div>
                </div>
              ))
            })()}

            <div className="notice" style={{ marginTop: 20, marginBottom: 6 }}>{t('stats.sales.byItem')}</div>
            {o.sales.byItem.length === 0 && <p className="notice">{t('stats.sales.none')}</p>}
            {o.sales.byItem.map((row, i) => (
              <div className="track-row" key={`${row.releaseId || row.collectionId}-${i}`}>
                <div className="ttitle">
                  {itemLabel(row, t)}
                  <div className="notice">
                    {t(`stats.scope.${row.scope}`)} · {t('stats.sales.paymentCount', { count: formatInt(row.payments, lang) })}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>{formatMoney(row.revenueCents, lang)} EUR</div>
              </div>
            ))}

            <div className="notice" style={{ marginTop: 20, marginBottom: 6 }}>{t('stats.sales.recent')}</div>
            {o.sales.recent.length === 0 && <p className="notice">{t('stats.sales.none')}</p>}
            {o.sales.recent.map((row, i) => (
              <div className="track-row" key={`${row.createdAt}-${i}`}>
                <div className="ttitle">
                  {itemLabel(row, t)}
                  <div className="notice">
                    {formatDateTime(row.createdAt, lang)} · {t(`stats.scope.${row.scope}`)} · {methodLabel(row, t)}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>{amountLabel(row, lang)}</div>
              </div>
            ))}
          </div>

          {/* ---------- Mest spillede numre ---------- */}
          <div style={SECTION}>
            <h3 style={{ fontSize: 17, marginBottom: 12 }}>{t('stats.topTracks.title')}</h3>
            {o.topTracks.length === 0 && <p className="notice">{t('stats.topTracks.empty')}</p>}
            {o.topTracks.map((track) => (
              <div className="track-row" key={track.trackId}>
                <div className="ttitle">
                  {track.title}
                  <div className="notice">
                    {track.artist ? `${track.artist} · ` : ''}
                    <Link href={`/admin/statistik/${track.releaseId}${query}`}>{track.releaseTitle}</Link>
                  </div>
                </div>
                <div className="notice" style={{ flexShrink: 0, textAlign: 'right' }}>
                  {t('stats.topTracks.row', {
                    period: formatInt(track.playsPeriod, lang),
                    total: formatInt(track.playsTotal, lang),
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* ---------- Kollektioner ---------- */}
          <div style={SECTION}>
            <h3 style={{ fontSize: 17, marginBottom: 12 }}>{t('stats.collections.title')}</h3>
            {o.collections.length === 0 && <p className="notice">{t('stats.collections.empty')}</p>}
            {o.collections.map((collection) => (
              <div className="track-row" key={collection.collectionId}>
                <div className="ttitle">
                  {itemLabel({ scope: 'collection', collectionTitle: collection.title, season: collection.season, year: collection.year }, t)}
                  <div className="notice">
                    {t('stats.collections.row', {
                      releases: formatInt(collection.releases, lang),
                      unlocks: formatInt(collection.unlocks, lang),
                      downloads: formatInt(collection.downloads, lang),
                    })}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>{formatMoney(collection.revenueCents, lang)} EUR</div>
              </div>
            ))}
          </div>

          {/* ---------- Brugere og indhold ---------- */}
          <div style={SECTION}>
            <h3 style={{ fontSize: 17, marginBottom: 12 }}>{t('stats.users.title')}</h3>
            <p className="notice">
              {t('stats.users.roles', {
                listeners: formatInt(o.users.listeners, lang),
                publishers: formatInt(o.users.publishers, lang),
                admins: formatInt(o.users.admins, lang),
              })}
            </p>
            <p className="notice" style={{ marginTop: 4 }}>
              {t('stats.users.catalog', {
                releases: formatInt(o.catalog.releases, lang),
                tracks: formatInt(o.catalog.tracks, lang),
                artists: formatInt(o.catalog.artists, lang),
                collections: formatInt(o.catalog.collections, lang),
              })}
            </p>
            <p className="notice" style={{ marginTop: 4 }}>
              {t('stats.users.neverPlayed', { count: formatInt(o.catalog.neverPlayed, lang) })}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
