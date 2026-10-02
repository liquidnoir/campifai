// Konverterer lydfiler til MP3 (320 Kbps) eller FLAC (tabsfrit) direkte i browseren,
// via ffmpeg.wasm. Intet rører serveren — det samme princip som zip-download.
//
// ffmpeg.wasm-kernen (ca. 25-30 MB) hentes kun, når brugeren rent faktisk downloader,
// og kun én gang pr. besøg (genbruges til alle numre).
//
// Hvert trin logger til konsollen (console.log/console.error), så en fejl kan
// spores til præcis dér, hvor den opstår — indlæsning af selve ffmpeg.wasm-værktøjet,
// eller selve konverteringen af en given fil.
let ffmpegPromise = null

async function getFFmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      console.log('[transcode] Indlæser @ffmpeg/ffmpeg og @ffmpeg/util...')
      let FFmpeg, toBlobURL
      try {
        ;({ FFmpeg } = await import('@ffmpeg/ffmpeg'))
        ;({ toBlobURL } = await import('@ffmpeg/util'))
      } catch (err) {
        console.error('[transcode] Kunne ikke importere @ffmpeg/ffmpeg eller @ffmpeg/util:', err)
        throw err
      }
      console.log('[transcode] Biblioteker indlæst. Opretter FFmpeg-instans...')

      const ffmpeg = new FFmpeg()
      ffmpeg.on('log', ({ message }) => console.log('[ffmpeg]', message))

      // Enkelt-trådet kerne, med vilje — kræver ikke de særlige COOP/COEP-headers,
      // som den flertrådede udgave gør, og som denne side ikke sætter.
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
      console.log('[transcode] Henter ffmpeg-core fra', baseURL, '...')
      let coreURL, wasmURL
      try {
        coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript')
        wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
      } catch (err) {
        console.error('[transcode] Kunne ikke hente ffmpeg-core-filerne (netværk/CORS?):', err)
        throw err
      }
      console.log('[transcode] Kerne-filer hentet. Starter ffmpeg.load()...')

      try {
        await ffmpeg.load({ coreURL, wasmURL })
      } catch (err) {
        console.error('[transcode] ffmpeg.load() fejlede:', err)
        throw err
      }
      console.log('[transcode] ffmpeg.wasm er klar.')
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

  console.log('[transcode] Skriver', inputName, `(${blob.size} bytes) til det virtuelle filsystem...`)
  const data = new Uint8Array(await blob.arrayBuffer())
  await ffmpeg.writeFile(inputName, data)

  try {
    const cmd = ['-i', inputName, ...spec.args, outputName]
    console.log('[transcode] Kører: ffmpeg', cmd.join(' '))
    await ffmpeg.exec(cmd)
    console.log('[transcode] Konvertering færdig, læser', outputName, '...')
    const result = await ffmpeg.readFile(outputName)
    console.log('[transcode]', outputName, `klar (${result.length} bytes).`)
    return { blob: new Blob([result.buffer], { type: format === 'mp3' ? 'audio/mpeg' : 'audio/flac' }), ext: spec.ext }
  } catch (err) {
    console.error('[transcode] ffmpeg.exec()/readFile() fejlede for', inputName, ':', err)
    throw err
  } finally {
    // Ryd op i det virtuelle filsystem, så hukommelsen ikke vokser sig stor
    // hen over mange numre i træk.
    await ffmpeg.deleteFile(inputName).catch(() => {})
    await ffmpeg.deleteFile(outputName).catch(() => {})
  }
}
