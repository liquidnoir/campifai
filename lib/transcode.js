// Konverterer lydfiler til MP3 (320 Kbps) eller FLAC (tabsfrit) direkte i browseren,
// via ffmpeg.wasm. Intet rører serveren — det samme princip som zip-download.
//
// ffmpeg.wasm-kernen (ca. 25-30 MB) hentes kun, når brugeren rent faktisk downloader,
// og kun én gang pr. besøg (genbruges til alle numre).
//
// Hvert trin logger til konsollen, så en fejl kan spores til præcis dér, hvor den opstår.
let ffmpegPromise = null

const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
const PKG_BASE = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm'
const LOAD_TIMEOUT_MS = 90_000

// ffmpeg.wasms egen worker.js bruger en kommentar beregnet til Vite ("@vite-ignore"),
// som webpack (Next.js' byggeværktøj) ikke forstår. Derfor henter vi worker.js udefra
// i stedet for at lade webpack pakke den ind i appen.
//
// Worker-filen importerer dog sine søsterfiler med relative stier ("./const.js").
// Ligger den som en blob:-adresse, kan de stier ikke løses op. Vi omskriver dem derfor
// til fulde adresser, før blob'en oprettes.
async function createWorkerBlobURL() {
  const res = await fetch(`${PKG_BASE}/worker.js`)
  if (!res.ok) throw new Error(`Kunne ikke hente worker.js (HTTP ${res.status})`)
  let source = await res.text()
  let replaced = 0
  const fix = (match, before, file, after) => {
    replaced++
    return `${before}${PKG_BASE}/${file}${after}`
  }
  source = source.replace(/(from\s*["'])\.\/([\w-]+\.js)(["'])/g, fix)
  source = source.replace(/(import\s*["'])\.\/([\w-]+\.js)(["'])/g, fix)
  console.log('[transcode] worker.js: omskrev', replaced, 'relative imports til fulde adresser')
  if (replaced === 0) {
    console.warn('[transcode] Fandt ingen relative imports i worker.js — begyndelsen af filen:', source.slice(0, 300))
  }
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
}

async function loadFFmpeg() {
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
  console.log('[transcode] Henter ffmpeg-core og worker-fil fra unpkg...')
  let coreURL, wasmURL, classWorkerURL
  try {
    coreURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript')
    wasmURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm')
    classWorkerURL = await createWorkerBlobURL()
  } catch (err) {
    console.error('[transcode] Kunne ikke hente ffmpeg-filerne (netværk/CORS?):', err)
    throw err
  }
  console.log('[transcode] Filer hentet. Starter ffmpeg.load()...')

  // Tidsgrænse, så grænsefladen ikke hænger for evigt, hvis worker'en aldrig svarer.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS)
  try {
    await ffmpeg.load({ coreURL, wasmURL, classWorkerURL }, { signal: controller.signal })
  } catch (err) {
    console.error('[transcode] ffmpeg.load() fejlede:', err)
    throw err
  } finally {
    clearTimeout(timer)
  }
  console.log('[transcode] ffmpeg.wasm er klar.')
  return ffmpeg
}

function getFFmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = loadFFmpeg().catch((err) => {
      // Husk ikke en fejlet indlæsning — ellers fejler alle senere forsøg øjeblikkeligt,
      // indtil siden genindlæses.
      ffmpegPromise = null
      throw err
    })
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
