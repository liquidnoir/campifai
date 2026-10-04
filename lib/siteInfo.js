// Oplysninger om, hvem der står bag tjenesten. Bruges i vilkår, privatlivspolitik,
// kontaktsiden og i bunden af siden.
//
// >>> UDFYLD de tomme felter, før siderne offentliggøres. <<<
// Mangler der noget, vises en tydelig advarsel øverst på de juridiske sider.
export const SITE = {
  name: 'We Built Other',
  // Den juridisk ansvarlige: dit eget navn (personligt ejet virksomhed) eller firmaets navn
  operator: 'We Built Other',
  // Adresse, som den skal stå i vilkår og på kontaktsiden (gade, postnummer og by)
  address: 'Paradisæblevej 11, 8260 Viby J',
  // CVR-nummer, hvis I har et (kan være tomt)
  cvr: '',
  // E-mailadresse, folk kan skrive til — også til anmeldelse af indhold og henvendelser om persondata
  email: 'tuliphead@gmail.com',
  // Adressen på siden
  siteUrl: 'https://webuiltother.vercel.app',
  // Dato for seneste ændring af de juridiske tekster (ÅÅÅÅ-MM-DD). Opdatér den, når teksterne ændres.
  legalUpdated: '2026-10-05',
}

// Hvilke obligatoriske felter mangler stadig?
export function missingSiteInfo(site = SITE) {
  return ['operator', 'address', 'email'].filter((key) => !String(site[key] || '').trim())
}

// "Navn, adresse, CVR 12345678" — kun med de dele, der er udfyldt
export function operatorBlock(site = SITE, placeholder = '[ansvarlig]') {
  const parts = [String(site.operator || '').trim() || placeholder]
  if (String(site.address || '').trim()) parts.push(site.address.trim())
  if (String(site.cvr || '').trim()) parts.push(`CVR ${site.cvr.trim()}`)
  return parts.join(', ')
}
