// Sæsonlabels til kollektioner (nedarvet fra fire årlige moderekollektioner)
export const SEASON_LABELS = {
  spring: 'Forår',
  summer: 'Sommer',
  autumn: 'Efterår',
  winter: 'Vinter',
}

export const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter']

export function collectionTitle(c) {
  if (c.title && c.title.trim()) return c.title.trim()
  return `${SEASON_LABELS[c.season] || c.season} ${c.year}`
}
