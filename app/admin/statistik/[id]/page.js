'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { useLanguage } from '../../../../components/LanguageProvider'
import { KpiCard, PeriodControls } from '../../../../components/StatsParts'
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
} from '../../../../lib/statsFormat'

export default function AdminReleaseStatsPage() {
  const { t, lang } = useLanguage()
  const { id } = useParams()
  const router = useRouter()
  const [session, setSession] = useState(undefined)
  const [me, setMe] = useState(null)
  const [checked, setChecked] = useState(false)
  const [days, setDays] = useState(30)
  const [includeOwn, setIncludeOwn] = useState(false)
  const [ready, setReady] = useState(false)
  const [stats, setStats] = useState(undefined) // undefined = henter, null = findes ikke
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestRef = useRef(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
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
  }, [ready, me, days, includeOwn, id])

  async function load(requestId) {
    const { data, error: rpcError } = await supabase.rpc('admin_release_stats', {
      p_release_id: id,
      p_days: days,
      p_include_own: includeOwn,
    })
    if (requestId !== requestRef.current) return
    if (rpcError) {
      setError(rpcError.message)
      setStats(undefined)
    } else {
      setError('')
      setStats(data)
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

  const back = (
    <p style={{ marginBottom: 8 }}>
      <Link href={`/admin/statistik${periodToQuery(days, includeOwn)}`}>← {t('stats.back')}</Link>
    </p>
  )

  if (stats === null) {
    return (
      <section>
        {back}
        <p className="notice">{t('release.notFound')}</p>
      </section>
    )
  }

  const totals = stats?.totals
  const tracks = stats?.tracks || []
  const peak = maxOf(tracks, 'playsTotal')

  return (
    <section>
      {back}
      {error && <div className="error-msg">{t('stats.error', { message: error })}</div>}
      {!stats && !error && <p className="notice">{t('common.loading')}</p>}

      {stats && (
        <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
          <div className="section-head">
            <h2>{stats.release.title}</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href={`/release/${stats.release.id}`} className="btn ghost">
                {t('stats.release.openPublic')}
              </Link>
              <Link href={`/admin/releases/${stats.release.id}`} className="btn ghost">
                {t('common.edit')}
              </Link>
            </div>
          </div>
          <p className="notice">
            {stats.release.artist || t('home.unknownArtist')} · {t(`type.${stats.release.type}`)}
            {stats.release.genre ? ` · ${stats.release.genre}` : ''}
          </p>
          <p className="notice">{t('artist.publishedBy', { name: stats.release.publisher || t('admin.unknown') })}</p>

          <PeriodControls
            days={days}
            includeOwn={includeOwn}
            onDays={setDays}
            onOwn={setIncludeOwn}
            disabled={loading}
          />
          {stats.eventsSince && (
            <p className="notice" style={{ marginTop: 12 }}>
              {t('stats.eventsNote', { date: formatDateTime(stats.eventsSince, lang) })}
            </p>
          )}

          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginTop: 16 }}
          >
            <KpiCard
              label={t('stats.kpi.plays')}
              value={formatInt(days === null ? totals.playsTotal : totals.playsPeriod, lang)}
              sub={
                days === null
                  ? t('stats.kpi.playsSubTimed', { period: formatInt(totals.playsPeriod, lang) })
                  : t('stats.kpi.playsSub', { total: formatInt(totals.playsTotal, lang) })
              }
            />
            <KpiCard label={t('stats.kpi.listeners')} value={formatInt(totals.uniqueListeners, lang)} />
            <KpiCard
              label={t('stats.release.unlocksDirect')}
              value={formatInt(totals.unlocksDirect, lang)}
              sub={t('stats.kpi.unlocksSub', {
                paid: formatInt(totals.unlocksPaid, lang),
                free: formatInt(totals.unlocksFree, lang),
                donation: formatInt(totals.unlocksDonation, lang),
              })}
            />
            <KpiCard
              label={t('stats.release.unlocksViaCollection')}
              value={formatInt(totals.unlocksViaCollection, lang)}
            />
            <KpiCard label={t('stats.release.revenue')} value={`${formatMoney(totals.revenueCents, lang)} EUR`} />
            <KpiCard
              label={t('stats.kpi.downloads')}
              value={formatInt(totals.downloadsDirect + totals.downloadsViaCollection, lang)}
              sub={t('stats.release.downloadsSub', {
                direct: formatInt(totals.downloadsDirect, lang),
                viaCollection: formatInt(totals.downloadsViaCollection, lang),
              })}
            />
          </div>

          <h3 style={{ fontSize: 17, marginTop: 32, marginBottom: 12 }}>{t('stats.release.tracks')}</h3>
          {tracks.length === 0 && <p className="notice">{t('adminRelease.noTracks')}</p>}
          {tracks.map((track, index) => (
            <div className="panel" key={track.trackId} style={{ padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <div>
                  {index + 1}. {track.title}
                  {track.artist && track.artist !== stats.release.artist && (
                    <div className="notice">{track.artist}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 500 }}>
                    {formatInt(days === null ? track.playsTotal : track.playsPeriod, lang)}
                  </div>
                  <div className="notice" style={{ fontSize: 12 }}>
                    {days === null
                      ? t('stats.release.trackRowTimed', {
                          period: formatInt(track.playsPeriod, lang),
                          listeners: formatInt(track.uniqueListeners, lang),
                        })
                      : t('stats.release.trackRow', {
                          total: formatInt(track.playsTotal, lang),
                          listeners: formatInt(track.uniqueListeners, lang),
                        })}
                  </div>
                </div>
              </div>
              <div style={{ background: '#2a251c', borderRadius: 2, height: 6, marginTop: 8 }}>
                <div
                  data-total-bar={track.playsTotal}
                  style={{ width: `${(track.playsTotal / peak) * 100}%`, height: '100%', background: '#D9734F', borderRadius: 2 }}
                />
              </div>
            </div>
          ))}

          <h3 style={{ fontSize: 17, marginTop: 32, marginBottom: 12 }}>{t('stats.release.recentUnlocks')}</h3>
          {stats.recentUnlocks.length === 0 && <p className="notice">{t('stats.sales.none')}</p>}
          {stats.recentUnlocks.map((row, i) => (
            <div className="track-row" key={`${row.createdAt}-${i}`}>
              <div className="ttitle">
                {row.scope === 'collection'
                  ? t('stats.release.viaCollection', { name: itemLabel(row, t) })
                  : t('stats.scope.release')}
                <div className="notice">
                  {formatDateTime(row.createdAt, lang)} · {methodLabel(row, t)}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>{amountLabel(row, lang)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
