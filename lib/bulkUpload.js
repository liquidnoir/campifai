// Hjælpere til upload af flere numre på én gang.

export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'aiff', 'aif']
const EXTENSION_PATTERN = new RegExp(`\\.(${AUDIO_EXTENSIONS.join('|')})$`, 'i')

// Nummerets titel udfyldes ud fra filnavnet, uden filtypenavnet.
// "01 - Intro.mp3" → "01 - Intro". Er det ikke et kendt lydfilnavn, beholdes navnet urørt,
// så intet bliver skåret af ved en fejl (publisheren kan altid rette titlen).
export function titleFromFileName(name) {
  const raw = String(name ?? '').trim()
  const stripped = raw.replace(EXTENSION_PATTERN, '').trim()
  return stripped || raw
}

export function isAudioFile(file) {
  return EXTENSION_PATTERN.test(file.name || '') || String(file.type || '').startsWith('audio/')
}

// Sortering, der forstår tal: "Track 2" kommer før "Track 10"
export function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

// Til at genkende den samme fil, hvis den vælges to gange
export function fileKey(file) {
  return `${file.name}|${file.size}|${file.lastModified}`
}

export function formatMb(bytes, lang = 'da') {
  return (bytes / 1024 / 1024).toLocaleString(lang === 'en' ? 'en-GB' : 'da-DK', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

// Afgør, hvilke af de valgte filer der kommer med, og hvorfor de øvrige ikke gør.
//   files:     de valgte filer
//   slots:     hvor mange numre der må være mere på udgivelsen
//   maxBytes:  største filstørrelse
//   seenKeys:  filer, der allerede står i listen (så de ikke kommer med to gange)
// Filerne sorteres efter navn (med tal i rigtig rækkefølge), og de første slots kommer med.
// Returnerer { accepted: [File], rejected: [{ file, reason }] }
// hvor reason er "duplicate" | "notAudio" | "empty" | "tooBig" | "limit".
export function planSelection({ files, slots, maxBytes, seenKeys = new Set() }) {
  const sorted = [...files].sort((a, b) => naturalCompare(a.name, b.name))
  const seen = new Set(seenKeys)
  const accepted = []
  const rejected = []
  for (const file of sorted) {
    const key = fileKey(file)
    if (seen.has(key)) {
      rejected.push({ file, reason: 'duplicate' })
    } else if (!isAudioFile(file)) {
      rejected.push({ file, reason: 'notAudio' })
    } else if (file.size === 0) {
      rejected.push({ file, reason: 'empty' })
    } else if (file.size > maxBytes) {
      rejected.push({ file, reason: 'tooBig' })
    } else if (accepted.length >= slots) {
      rejected.push({ file, reason: 'limit' })
    } else {
      seen.add(key)
      accepted.push(file)
    }
  }
  return { accepted, rejected }
}
