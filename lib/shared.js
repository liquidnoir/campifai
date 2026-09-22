// Maks. antal kunstnere en publisher kan oprette (håndhæves også i databasen)
export const MAX_ARTISTS = 50

export const ROLE_LABELS = {
  listener: 'Lytter',
  publisher: 'Publisher',
  admin: 'Admin',
}

// Udgivelsestyper og deres grænse for antal numre (håndhæves også i databasen)
export const RELEASE_TYPE_LABELS = {
  album: 'Album',
  ep: 'EP',
  single: 'Single',
}

export const RELEASE_TYPE_LIMITS = {
  album: 50,
  ep: 6,
  single: 1,
}

// Publishers og admins kan oprette kunstnere, udgivelser og uploade musik
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
export async function removeFolderFiles(supabase, folder) {
  for (let i = 0; i < 50; i++) {
    const { data: files, error: listError } = await supabase.storage
      .from('tracks')
      .list(folder, { limit: 100 })
    if (listError) throw listError
    if (!files || files.length === 0) return
    const { data: removed, error: removeError } = await supabase.storage
      .from('tracks')
      .remove(files.map((f) => `${folder}/${f.name}`))
    if (removeError) throw removeError
    if (!removed || removed.length === 0) {
      throw new Error('Kunne ikke slette alle lydfilerne. Prøv igen.')
    }
  }
}
