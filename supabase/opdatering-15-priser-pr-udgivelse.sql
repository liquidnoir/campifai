-- ============================================
-- WE BUILT OTHER — opdatering 15
-- Pris pr. udgivelse: mindste-, foreslået og maksimalpris, sat af publisheren.
-- Tomme felter (null) betyder: brug standardprisen for udgivelsens type.
-- Kør hele filen i Supabase: SQL Editor > New query > Run
-- Kør den FØR den nye kode lægges online (den er bagudkompatibel).
-- ============================================

alter table public.releases
  add column price_min_cents integer,
  add column price_suggested_cents integer,
  add column price_max_cents integer;

-- Enten er alle tre tomme (standardpris), eller også er alle tre sat og hænger sammen:
--   0 <= mindste <= foreslået <= maks, maks mellem 0,50 og 500 EUR.
-- Et beløb over 0 skal være mindst 0,50 EUR, da Stripe afviser alt mindre.
alter table public.releases
  add constraint releases_price_check check (
    (price_min_cents is null and price_suggested_cents is null and price_max_cents is null)
    or (
      price_min_cents is not null
      and price_suggested_cents is not null
      and price_max_cents is not null
      and price_min_cents >= 0
      and price_min_cents <= price_suggested_cents
      and price_suggested_cents <= price_max_cents
      and price_max_cents between 50 and 50000
      and (price_min_cents = 0 or price_min_cents >= 50)
      and (price_suggested_cents = 0 or price_suggested_cents >= 50)
    )
  );
