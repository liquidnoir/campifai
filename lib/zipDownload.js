import JSZip from 'jszip'
import { transcodeAudio } from './transcode'

export function safeFileNamePart(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) || 'fil'
}

// format: undefined/"original" = ingen konvertering (som filerne blev uploadet).
// "mp3" eller "flac" konverterer hvert nummer i browseren, før det lægges i zip'en.
async function fetchAndMaybeConvert(tr, format, t) {
  const res = await fetch(tr.url)
  if (!res.ok) {
    throw new Error(t ? t('zip.couldNotFetch', { title: tr.title }) : `Could not fetch "${tr.title}".`)
  }
  const blob = await res.blob()
  const sourceExt = (tr.audio_path.split('.').pop() || 'audio').toLowerCase()
  if (!format || format === 'original') return { blob, ext: sourceExt }
  try {
    return await transcodeAudio(blob, sourceExt, format)
  } catch (err) {
    // Den tekniske fejl er vigtig at kunne se i konsollen under fejlsøgning —
    // brugeren ser kun den pæne besked nedenunder, men vi skjuler den ikke for os selv.
    console.error('Lydkonvertering fejlede for', tr.title, err)
    if (err?.name === 'NoAudioError') {
      throw new Error(
        t ? t('zip.noAudio', { title: tr.title }) : `"${tr.title}" has no audio track and cannot be converted.`
      )
    }
    throw new Error(
      t ? t('zip.conversionFailed', { title: tr.title }) : `Could not convert "${tr.title}".`
    )
  }
}

// tracks: [{ title, audio_path, url }]
export async function downloadReleaseZip(release, tracks, onProgress, t, format) {
  const zip = new JSZip()
  for (let i = 0; i < tracks.length; i++) {
    const tr = tracks[i]
    onProgress?.(i + 1, tracks.length, format && format !== 'original' ? 'convert' : 'fetch')
    const { blob, ext } = await fetchAndMaybeConvert(tr, format, t)
    const filename = `${String(i + 1).padStart(2, '0')} - ${safeFileNamePart(tr.title)}.${ext}`
    zip.file(filename, blob)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeFileNamePart(release.title)}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// releaseGroups: [{ title, tracks: [{ title, audio_path, url }] }]
// Downloader hele kollektionen som én zip, med én mappe pr. udgivelse.
export async function downloadCollectionZip(collectionTitle, releaseGroups, onProgress, t, format) {
  const zip = new JSZip()
  const totalTracks = releaseGroups.reduce((sum, g) => sum + g.tracks.length, 0)
  let done = 0
  for (const group of releaseGroups) {
    const folder = zip.folder(safeFileNamePart(group.title))
    for (let i = 0; i < group.tracks.length; i++) {
      const tr = group.tracks[i]
      done++
      onProgress?.(done, totalTracks, format && format !== 'original' ? 'convert' : 'fetch')
      const { blob, ext } = await fetchAndMaybeConvert(tr, format, t)
      const filename = `${String(i + 1).padStart(2, '0')} - ${safeFileNamePart(tr.title)}.${ext}`
      folder.file(filename, blob)
    }
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeFileNamePart(collectionTitle)}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
