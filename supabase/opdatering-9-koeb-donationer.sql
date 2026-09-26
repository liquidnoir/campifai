-- ============================================
-- CAMPIFAI — opdatering 9
-- Køb/donationer: tillidsbaseret adgang til download af en udgivelse
-- eller en hel kollektion. Betaling med kort (Stripe) tilføjes senere.
-- Kør hele filen i Supabase: SQL Editor > New query > Run
-- Kør den lige efter den nye kode er lagt online på Vercel.
-- ============================================

create table public.purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  scope text not null check (scope in ('release', 'collection')),
  release_id uuid references public.releases(id) on delete cascade,
  collection_id uuid references public.collections(id) on delete cascade,
  method text not null check (method in ('donation_ecf', 'donation_sweet_relief', 'stripe')),
  created_at timestamp with time zone default now(),
  constraint purchases_scope_matches_id check (
    (scope = 'release' and release_id is not null and collection_id is null)
    or
    (scope = 'collection' and collection_id is not null and release_id is null)
  )
);

-- Undgå dubletter (samme bruger kan ikke "købe" det samme to gange)
create unique index purchases_unique_release on public.purchases (user_id, release_id) where release_id is not null;
create unique index purchases_unique_collection on public.purchases (user_id, collection_id) where collection_id is not null;

create index purchases_user_id_idx on public.purchases (user_id);
create index purchases_release_id_idx on public.purchases (release_id);
create index purchases_collection_id_idx on public.purchases (collection_id);

alter table public.purchases enable row level security;

create policy "Man kan kun se egne køb"
  on public.purchases for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Admin kan se alle køb"
  on public.purchases for select
  to authenticated
  using (public.is_admin());

create policy "Man kan kun oprette køb i eget navn"
  on public.purchases for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Admin kan slette køb"
  on public.purchases for delete
  to authenticated
  using (public.is_admin());
