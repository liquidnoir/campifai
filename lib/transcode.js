// Konverterer lydfiler til MP3 (320 Kbps) eller FLAC (tabsfrit) direkte i browseren,
// via ffmpeg.wasm. Intet rører serveren — det samme princip som zip-download.
//
// ffmpeg.wasm-kernen (ca. 25-30 MB) hentes kun, hvis brugeren rent faktisk vælger et
// andet format end "Original", og kun én gang pr. besøg (genbruges til alle numre).
let ffmpegPromise = null

async function getFFmpeg(onLog) {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      const { toBlobURL } = await import('@ffmpeg/util')
      const ffmpeg = new FFmpeg()
      if (onLog) ffmpeg.on('log', ({ message }) => onLog(message))
      // Enkelt-trådet kerne, med vilje — kræver ikke de særlige COOP/COEP-headers,
      // som den flertrådede udgave gør, og som denne side ikke sætter.
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      return ffmpeg
    })()
  }
  return ffmpegPromise
}

const FORMAT_ARGS = {
  mp3: { ext: 'mp3', args: ['-c:a', 'libmp3lame', '-b:a', '320k'] },
  flac: { ext: 'flac', args: ['-c:a', 'flac', '-compression_level', '5'] },
}

// blob: den originale lydfil. sourceExt: dens filtype (fx "wav", "m4a"), uden punktum.
// format: "mp3" eller "flac". Returnerer { blob, ext }.
export async function transcodeAudio(blob, sourceExt, format) {
  const spec = FORMAT_ARGS[format]
  if (!spec) throw new Error(`Ukendt format: ${format}`)

  const ffmpeg = await getFFmpeg()
  const inputName = `input.${sourceExt || 'audio'}`
  const outputName = `output.${spec.ext}`

  const data = new Uint8Array(await blob.arrayBuffer())
  await ffmpeg.writeFile(inputName, data)
  try {
    await ffmpeg.exec(['-i', inputName, ...spec.args, outputName])
    const result = await ffmpeg.readFile(outputName)
    return { blob: new Blob([result.buffer], { type: format === 'mp3' ? 'audio/mpeg' : 'audio/flac' }), ext: spec.ext }
  } finally {
    // Ryd op i det virtuelle filsystem, så hukommelsen ikke vokser sig stor
    // hen over mange numre i træk.
    await ffmpeg.deleteFile(inputName).catch(() => {})
    await ffmpeg.deleteFile(outputName).catch(() => {})
  }
}
