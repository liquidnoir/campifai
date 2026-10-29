// Videofiler: en musikvideo lægges op og afspilles som et nummer. Filtypen afgør, om et nummer er en video
// (der gemmes ingenting ekstra i databasen). Selve afspilleren tjekker desuden, om filen faktisk har billede.

export const VIDEO_EXTENSIONS = ['mp4', 'm4v', 'webm']
const VIDEO_PATTERN = new RegExp(`\\.(${VIDEO_EXTENSIONS.join('|')})$`, 'i')

// Er stien (eller adressen) en videofil? Forespørgselstegn og anker i en adresse ignoreres.
export function isVideoPath(path) {
  const clean = String(path || '').split('?')[0].split('#')[0]
  return VIDEO_PATTERN.test(clean)
}

// Er den valgte fil en video (efter navn eller type)?
export function isVideoFile(file) {
  return VIDEO_PATTERN.test(file?.name || '') || /^video\/(mp4|webm|x-m4v)$/.test(String(file?.type || ''))
}

// Filformatet som et nummer ligger i, aflæst af filendelsen i stien, fx "WAV", "MP3" eller "MP4". Tom streng, hvis den ikke kan aflæses.
export function formatLabelFromPath(path) {
  const clean = String(path || '').split('?')[0].split('#')[0]
  const match = /\.([a-z0-9]{1,5})$/i.exec(clean)
  if (!match) return ''
  const ext = match[1].toLowerCase()
  return (ext === 'aif' ? 'aiff' : ext === 'm4v' ? 'mp4' : ext).toUpperCase()
}
