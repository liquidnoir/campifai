// Små hjælpere til den fælles afspiller.

// Blander en liste (Fisher–Yates). Returnerer en ny liste.
export function shuffle(list, random = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// En kort tekst, der ændrer sig, når listen reelt er en anden (ikke blot en ny liste med samme indhold).
// Bruges i nøglen til en afspilningskilde, så en playliste, der ændres undervejs, ikke forveksles
// med den, der allerede spiller.
export function queueSignature(tracks) {
  return (tracks || []).map((x) => `${x.id}:${x.url ? 1 : 0}`).join('|')
}

// "1:05", "12:30", "1:02:03" — tid i sekunder som ur-tid. Ukendt eller ugyldig tid giver "0:00".
export function formatClock(seconds) {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

// Hvor langt henne (0–1) en position er, hvis nummeret er duration sekunder langt
export function fractionOf(position, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return 0
  const p = Number.isFinite(position) ? position : 0
  return Math.min(1, Math.max(0, p / duration))
}
