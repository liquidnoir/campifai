// "For 5 minutter siden", "i går", "3. okt." — til listen over senest afspillede udgivelser.

function locale(lang) {
  return lang === 'en' ? 'en-GB' : 'da-DK'
}

// Kalenderdagen i dansk tid som et løbenummer, så "i går" betyder den foregående kalenderdag
function copenhagenDayNumber(ms) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Copenhagen',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms)) // fx "2026-10-05"
  const [y, m, d] = parts.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

// iso: tidspunktet. justNow: teksten for "under et minut siden" (kommer fra oversættelserne).
export function formatPlayedAgo(iso, { lang = 'da', now = Date.now(), justNow = '' } = {}) {
  if (!iso) return '' // null og tom må ikke læses som 1. januar 1970
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const seconds = Math.max(0, Math.round((now - then) / 1000))
  if (seconds < 60) return justNow

  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' })
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return rtf.format(-minutes, 'minute')

  const dayDiff = copenhagenDayNumber(now) - copenhagenDayNumber(then)
  if (dayDiff <= 0) return rtf.format(-Math.floor(minutes / 60), 'hour')
  if (dayDiff < 7) return rtf.format(-dayDiff, 'day')
  return new Date(then).toLocaleDateString(locale(lang), {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Copenhagen',
  })
}
