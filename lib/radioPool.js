// Radioens udvælgelse af numre.
//
// Radioen spiller først genrens egne numre i tilfældig rækkefølge. Når genren ikke har flere
// uafspillede numre, fortsætter den med tilfældige numre fra andre genrer. Intet nummer
// kommer med to gange, før alt er spillet; først da blander afspilleren forfra.

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// rows: alle numre, hver med releases.genre. Returnerer to puljer af endnu ikke spillede numre.
// fromTrackId: hvis angivet og i genren, kommer det nummer først.
export function buildRadioPools(rows, genre, fromTrackId = '', shuffleFn = shuffle) {
  let inGenre = shuffleFn(rows.filter((tr) => tr.releases?.genre === genre))
  if (fromTrackId) {
    const at = inGenre.findIndex((tr) => tr.id === fromTrackId)
    if (at > 0) {
      const [first] = inGenre.splice(at, 1)
      inGenre = [first, ...inGenre]
    }
  }
  const other = shuffleFn(rows.filter((tr) => tr.releases?.genre !== genre))
  return { genre: inGenre, other }
}

// Tager næste portion ud af puljerne (og fjerner dem derfra).
// fromOtherGenres fortæller, om vi er gået over til andre genrer.
export function takeNextBatch(pools, size) {
  if (pools.genre.length > 0) return { rows: pools.genre.splice(0, size), fromOtherGenres: false }
  if (pools.other.length > 0) return { rows: pools.other.splice(0, size), fromOtherGenres: true }
  return { rows: [], fromOtherGenres: false }
}
