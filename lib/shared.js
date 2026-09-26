// Maks. antal kunstnere en publisher kan oprette (håndhæves også i databasen)
export const MAX_ARTISTS = 50

// Udgivelsestypernes grænse for antal numre (håndhæves også i databasen).
// Selve visningsteksterne (Album/EP/Single osv.) ligger i lib/translations.js
// under nøglerne "type.album", "type.ep", "type.single", da de skal oversættes.
export const RELEASE_TYPE_LIMITS = {
  album: 50,
  ep: 6,
  single: 1,
}

// Billeder til kunstnere og cover art til udgivelser (håndhæves også i databasen)
export const MAX_IMAGE_MB = 5
export const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024

// Publishers og admins kan oprette kunstnere, udgivelser og uploade musik/billeder
export function canPublish(role) {
  return role === 'publisher' || role === 'admin'
}

// Ens udseende til felter, som ikke ligger i en .field-boks
export const controlStyle = {
  width: '100%',
  padding: 10,
  boxSizing: 'border-box',
  font: 'inherit',
  color: 'inherit',
  background: 'transparent',
  border: '1px solid rgba(0,0,0,0.25)',
}

// Sletter alle lydfiler i en brugers mappe i bucketten "tracks"
export async function removeFolderFiles(supabase, folder, t) {
  await removeFolderFilesFromBucket(supabase, 'tracks', folder, t)
}

// Sletter alle billeder i en brugers mappe i bucketten "images"
export async function removeFolderImages(supabase, folder, t) {
  await removeFolderFilesFromBucket(supabase, 'images', folder, t)
}

async function removeFolderFilesFromBucket(supabase, bucket, folder, t) {
  for (let i = 0; i < 50; i++) {
    const { data: files, error: listError } = await supabase.storage
      .from(bucket)
      .list(folder, { limit: 100 })
    if (listError) throw listError
    if (!files || files.length === 0) return
    const { data: removed, error: removeError } = await supabase.storage
      .from(bucket)
      .remove(files.map((f) => `${folder}/${f.name}`))
    if (removeError) throw removeError
    if (!removed || removed.length === 0) {
      throw new Error(t ? t('errors.deleteFilesFailed') : 'Could not delete all the files. Please try again.')
    }
  }
}

export function imageTooBigMessage(bytes, t) {
  const mb = (bytes / 1024 / 1024).toFixed(1)
  if (t) return t('errors.imageTooBig', { mb, max: MAX_IMAGE_MB })
  return `The image is ${mb} MB, and the limit is ${MAX_IMAGE_MB} MB. Please choose a smaller image.`
}

// Fjerner tegn, som lagringen ikke kan lide (mellemrum, æøå osv.)
export function safeFileName(name) {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  const cleanBase =
    base
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'file'
  const cleanExt = ext.replace(/[^a-zA-Z0-9.]/g, '').toLowerCase()
  return cleanBase + cleanExt
}

// Uploader et billede til "images"-bucketten i brugerens egen mappe, og
// returnerer den offentlige URL. "kind" er blot en label i filnavnet
// (fx "artist" eller "release"), så flere billedtyper kan sameksistere.
export async function uploadImage(supabase, userId, kind, file, t) {
  if (!file.type.startsWith('image/')) {
    throw new Error(t ? t('errors.mustBeImage') : 'The file must be an image (JPG, PNG or WEBP).')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(imageTooBigMessage(file.size, t))
  }
  const path = `${userId}/${kind}-${Date.now()}-${safeFileName(file.name)}`
  const { error } = await supabase.storage.from('images').upload(path, file)
  if (error) throw error
  return path
}

export function imagePublicUrl(supabase, path) {
  if (!path) return null
  return supabase.storage.from('images').getPublicUrl(path).data.publicUrl
}

// Sletter et enkelt billede i "images"-bucketten. Fejler stille, hvis filen
// allerede er væk, så det ikke blokerer resten af en sletning/opdatering.
export async function removeImage(supabase, path) {
  if (!path) return
  await supabase.storage.from('images').remove([path])
}
