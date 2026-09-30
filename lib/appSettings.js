// Globale til/fra-kontakter for køb og donationer, samt et valgfrit brugerdefineret
// forsidebillede og hero-tekst (på begge sprog), alt sammen styret af admin.
// Fejler henvisningen (fx netværksfejl), antager vi "slået til" og "standardindhold"
// som standard, så en forbigående fejl ikke ved et uheld lukker for noget.
const DEFAULTS = {
  purchasesEnabled: true,
  donationsEnabled: true,
  heroImagePath: null,
  heroTitleDa: null,
  heroTitleEn: null,
  heroBodyDa: null,
  heroBodyEn: null,
}

export async function getAppSettings(supabase) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('purchases_enabled, donations_enabled, hero_image_path, hero_title_da, hero_title_en, hero_body_da, hero_body_en')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return DEFAULTS
  return {
    purchasesEnabled: data.purchases_enabled,
    donationsEnabled: data.donations_enabled,
    heroImagePath: data.hero_image_path,
    heroTitleDa: data.hero_title_da,
    heroTitleEn: data.hero_title_en,
    heroBodyDa: data.hero_body_da,
    heroBodyEn: data.hero_body_en,
  }
}
