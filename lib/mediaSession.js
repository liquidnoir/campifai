// Hjælpere til afspilleren: oplysninger til låseskærmen/hovedtelefoner (Media Session)
// og forhåndsindlæsning af næste nummer.

// Forhåndsindlæsningen af næste nummer starter, når der er højst så mange sekunder tilbage
// af det nuværende — eller når halvdelen er spillet, hvis det kommer først.
export const PREFETCH_SECONDS_BEFORE_END = 60
export const PREFETCH_AT_FRACTION = 0.5
// Filer over denne størrelse forhåndsindlæses ikke (de streames som vanligt)
export const MAX_PREFETCH_BYTES = 120 * 1024 * 1024

// Det, låseskærmen viser: titel, kunstner, album (udgivelsen) og cover.
// mediaArtist er den fulde kunstner (artistName kan være tom i selve listen for ikke at gentage den).
export function buildMediaMetadata(track) {
  const artwork = track?.coverUrl ? [{ src: track.coverUrl, sizes: '512x512' }] : []
  return {
    title: track?.title || '',
    artist: track?.mediaArtist || track?.artistName || '',
    album: track?.releaseTitle || '',
    artwork,
  }
}

// Skal næste nummer forhåndsindlæses nu? Ikke på langsom forbindelse eller i databesparelse.
export function shouldPrefetchNext({ currentTime, duration, connection }) {
  if (!Number.isFinite(duration) || duration <= 0) return false
  if (connection?.saveData) return false
  if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') return false
  const time = Number.isFinite(currentTime) ? currentTime : 0
  const left = duration - time
  return left <= PREFETCH_SECONDS_BEFORE_END || time / duration >= PREFETCH_AT_FRACTION
}

// contentLength er værdien af headeren "content-length" (tekst) eller null
export function isPrefetchTooLarge(contentLength) {
  const bytes = Number(contentLength)
  return Number.isFinite(bytes) && bytes > MAX_PREFETCH_BYTES
}

export function mediaSessionSupported(nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  return Boolean(nav && 'mediaSession' in nav && typeof globalThis.MediaMetadata === 'function')
}

// Lydfilens type ud fra filendelsen i adressen (til filer, der er gemt uden korrekt type).
// Returnerer null, hvis endelsen ikke er kendt.
const AUDIO_TYPES = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  aiff: 'audio/aiff',
  aif: 'audio/aiff',
}

export function audioMimeFromUrl(url) {
  const path = String(url || '').split('?')[0].split('#')[0]
  const match = path.match(/\.([a-z0-9]+)$/i)
  return match ? AUDIO_TYPES[match[1].toLowerCase()] || null : null
}

// Er den type, serveren oplyste, ubrugelig for en afspiller?
export function isGenericMime(type) {
  return !type || type === 'application/octet-stream' || type === 'binary/octet-stream'
}
