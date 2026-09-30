// Globale til/fra-kontakter for køb og donationer, styret af admin.
// Fejler henvisningen (fx netværksfejl), antager vi "slået til" som standard,
// så en forbigående fejl ikke ved et uheld lukker for hele betalingsfunktionen.
const DEFAULTS = { purchasesEnabled: true, donationsEnabled: true }

export async function getAppSettings(supabase) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('purchases_enabled, donations_enabled')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return DEFAULTS
  return {
    purchasesEnabled: data.purchases_enabled,
    donationsEnabled: data.donations_enabled,
  }
}
