// Sæsonrækkefølge til kollektioner. Selve visningsteksterne (Forår/Spring osv.)
// ligger i lib/translations.js under nøglerne "season.spring" osv., da de skal
// oversættes.
export const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter']

// t er den oversættelsesfunktion, useLanguage() giver (komponenten sender den ind,
// da denne fil ikke selv er en komponent og derfor ikke kan bruge hook'et).
export function collectionTitle(c, t) {
  if (c.title && c.title.trim()) return c.title.trim()
  const seasonLabel = t ? t(`season.${c.season}`) : c.season
  return `${seasonLabel} ${c.year}`
}
