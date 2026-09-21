# Rille

En simpel musikplatform: kunstnere opretter konto og uploader numre gratis, alle kan lytte. Ingen betaling.

## Sådan kommer du i gang

### 1. Opret et gratis Supabase-projekt
Gå til https://supabase.com → opret konto → "New project". Vent et par minutter mens det oprettes.

### 2. Opret databasen
I Supabase: **SQL Editor** → **New query** → indsæt hele indholdet af `supabase/schema.sql` → tryk **Run**.

### 3. Opret storage-bucket til lydfiler
I Supabase: **Storage** → **New bucket** → navngiv den `tracks` → slå **Public bucket** til → opret.

(Storage-policyerne nederst i `schema.sql` giver adgang til bucketten — de køres allerede i trin 2.)

### 4. Slå email-bekræftelse fra (valgfrit, gør test nemmere)
**Authentication** → **Providers** → **Email** → slå "Confirm email" fra. Ellers skal hver ny bruger bekræfte sin email, før login virker.

### 5. Hent dine nøgler
**Settings** → **API** → kopiér **Project URL** og **anon public key**.

Kopiér `.env.local.example` til en ny fil `.env.local` og indsæt dine værdier:
```
NEXT_PUBLIC_SUPABASE_URL=https://dit-projekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=din-anon-key
```

### 6. Kør projektet lokalt
```
npm install
npm run dev
```
Åbn http://localhost:3000

### 7. Sæt det online (gratis)
Læg koden på GitHub, gå til https://vercel.com → "Import project" → vælg dit repo → indsæt de samme to miljøvariabler under Vercels projektindstillinger → Deploy.

## Hvordan det hænger sammen
- **Konti**: `profiles`-tabellen gemmer om en bruger er `artist` eller `listener`, oprettet ved signup.
- **Upload**: kunstnere uploader lydfiler til Storage-bucketten `tracks`, i deres egen mappe (`brugerens-id/filnavn`), og gemmer en reference i `tracks`-tabellen.
- **Afspilning**: alle kan hente og afspille filerne direkte, da bucketten er offentlig.
- **Adgang**: Row Level Security sikrer, at man kun kan uploade/slette sine egne numre, men alle kan se og lytte.

## Naturlige næste skridt
- Redigér kunstnerprofil (bio, coverbillede)
- Søgning og genrefiltrering
- Afspilningslister
- Følg-funktion mellem lyttere og kunstnere
