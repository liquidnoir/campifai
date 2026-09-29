// KUN til brug i server-kode (app/api/...). Må aldrig importeres fra en klient-komponent,
// da den bruger service-nøglen, som omgår alle adgangsregler i databasen.
import { createClient } from '@supabase/supabase-js'

export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server-nøgler mangler (SUPABASE_SERVICE_ROLE_KEY)')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// Finder den indloggede bruger ud fra "Authorization: Bearer <access token>".
// Returnerer null, hvis tokenet mangler eller er ugyldigt.
export async function getUserFromRequest(admin, req) {
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}
