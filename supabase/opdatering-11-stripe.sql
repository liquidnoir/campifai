-- ============================================
-- CAMPIFAI — opdatering 11
-- Betaling med kort (Stripe): betalingsregistrering + sikring af adgangen.
-- Kør hele filen i Supabase: SQL Editor > New query > Run
-- Kør den lige efter den nye kode er lagt online på Vercel.
-- ============================================

-- 1) Kun donations-køb (æressystemet) må oprettes direkte fra browseren.
--    Køb med metoden "stripe" må KUN oprettes af serveren efter en bekræftet betaling.
--    (Serveren bruger service-nøglen, som ikke er underlagt disse regler.)
drop policy if exists "Man kan kun oprette køb i eget navn" on public.purchases;

create policy "Man kan kun oprette donationskøb i eget navn"
  on public.purchases for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and method in ('donation_ecf', 'donation_sweet_relief')
  );

-- 2) Betalinger (rigtige penge). Adskilt fra adgangen ("purchases"), så der
--    altid er en registrering af, hvad der er betalt, selv hvis brugeren
--    i forvejen havde adgang.
create table public.payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  scope text not null check (scope in ('release', 'collection')),
  release_id uuid references public.releases(id) on delete set null,
  collection_id uuid references public.collections(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null,
  stripe_session_id text not null unique,
  created_at timestamp with time zone default now()
);

create index payments_user_id_idx on public.payments (user_id);

alter table public.payments enable row level security;

-- Ingen insert/update/delete-regler: kun serveren (service-nøglen) kan skrive her.
create policy "Man kan kun se egne betalinger"
  on public.payments for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Admin kan se alle betalinger"
  on public.payments for select
  to authenticated
  using (public.is_admin());
