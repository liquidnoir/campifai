import JSZip from 'jszip'

export function safeFileNamePart(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) || 'fil'
}

// tracks: [{ title, audio_path, url }]
export async function downloadReleaseZip(release, tracks, onProgress, t) {
  const zip = new JSZip()
  for (let i = 0; i < tracks.length; i++) {
    const tr = tracks[i]
    onProgress?.(i + 1, tracks.length)
    const res = await fetch(tr.url)
    if (!res.ok) {
      throw new Error(t ? t('zip.couldNotFetch', { title: tr.title }) : `Could not fetch "${tr.title}".`)
    }
    const blob = await res.blob()
    const ext = (tr.audio_path.split('.').pop() || 'audio').toLowerCase()
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
export async function downloadCollectionZip(collectionTitle, releaseGroups, onProgress, t) {
  const zip = new JSZip()
  const totalTracks = releaseGroups.reduce((sum, g) => sum + g.tracks.length, 0)
  let done = 0
  for (const group of releaseGroups) {
    const folder = zip.folder(safeFileNamePart(group.title))
    for (let i = 0; i < group.tracks.length; i++) {
      const tr = group.tracks[i]
      const res = await fetch(tr.url)
      if (!res.ok) {
        throw new Error(t ? t('zip.couldNotFetch', { title: tr.title }) : `Could not fetch "${tr.title}".`)
      }
      const blob = await res.blob()
      const ext = (tr.audio_path.split('.').pop() || 'audio').toLowerCase()
      const filename = `${String(i + 1).padStart(2, '0')} - ${safeFileNamePart(tr.title)}.${ext}`
      folder.file(filename, blob)
      done++
      onProgress?.(done, totalTracks)
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
