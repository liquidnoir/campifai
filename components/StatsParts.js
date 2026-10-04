'use client'
import { useLanguage } from './LanguageProvider'
import { formatDay, formatInt, maxOf } from '../lib/statsFormat'

const BAR_COLOR = '#D9734F'
const EMPTY_BAR_COLOR = '#3B3426'

// Valg af periode (7, 30, 90 dage eller i alt) og om egne afspilninger skal med
export function PeriodControls({ days, includeOwn, onDays, onOwn, disabled }) {
  const { t } = useLanguage()
  const periods = [
    { days: 7, label: t('stats.period.7') },
    { days: 30, label: t('stats.period.30') },
    { days: 90, label: t('stats.period.90') },
    { days: null, label: t('stats.period.all') },
  ]
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {periods.map((period) => (
          <button
            key={String(period.days)}
            type="button"
            className={days === period.days ? 'btn' : 'btn ghost'}
            disabled={disabled}
            onClick={() => onDays(period.days)}
          >
            {period.label}
          </button>
        ))}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 14 }}>
        <input type="checkbox" checked={includeOwn} disabled={disabled} onChange={(e) => onOwn(e.target.checked)} />
        {t('stats.includeOwn')}
      </label>
    </div>
  )
}

// Et stort tal med en forklarende tekst, til overblikket øverst
export function KpiCard({ label, value, sub, children }) {
  return (
    <div className="panel" style={{ padding: 14 }}>
      <div className="notice">{label}</div>
      <div style={{ fontSize: 26, fontWeight: 500, marginTop: 4 }}>{value}</div>
      {sub && <div className="notice" style={{ marginTop: 4 }}>{sub}</div>}
      {children}
    </div>
  )
}

// Et lille tal med tekst over (bruges i rækkerne i listerne)
export function Stat({ label, value, sub }) {
  return (
    <div>
      <div className="notice" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 500 }}>{value}</div>
      {sub && <div className="notice" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  )
}

// Små søjler for hver dag. rows: [{ day: "2026-10-04", <field>: tal }]
export function MiniBars({ title, rows, field }) {
  const { t, lang } = useLanguage()
  const peak = maxOf(rows, field)
  const total = rows.reduce((sum, row) => sum + Number(row[field] || 0), 0)
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span className="notice">{title}</span>
        <span className="notice">
          {formatInt(total, lang)} · {t('stats.trend.peak', { count: formatInt(Math.max(0, ...rows.map((row) => Number(row[field] || 0))), lang) })}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 56, marginTop: 6 }}>
        {rows.map((row) => {
          const value = Number(row[field] || 0)
          return (
            <div
              key={row.day}
              data-bar={value}
              title={`${formatDay(row.day, lang)}: ${formatInt(value, lang)}`}
              style={{
                flex: 1,
                minWidth: 2,
                height: `${value > 0 ? Math.max(8, (value / peak) * 100) : 3}%`,
                background: value > 0 ? BAR_COLOR : EMPTY_BAR_COLOR,
                borderRadius: 1,
              }}
            />
          )
        })}
      </div>
      {rows.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span className="notice" style={{ fontSize: 11 }}>{formatDay(rows[0].day, lang)}</span>
          <span className="notice" style={{ fontSize: 11 }}>{formatDay(rows[rows.length - 1].day, lang)}</span>
        </div>
      )}
    </div>
  )
}
