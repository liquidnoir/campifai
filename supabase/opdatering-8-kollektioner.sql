-- ============================================
-- CAMPIFAI — opdatering 8
-- Kollektioner (Forår/Sommer/Efterår/Vinter for et givent år).
-- Kun admin kan oprette, redigere, enable/disable og fylde dem med udgivelser.
-- Kør hele filen i Supabase: SQL Editor > New query > Run
-- Kør den lige efter den nye kode er lagt online på Vercel.
-- ============================================

create table public.collections (
  id uuid default gen_random_uuid() primary key,
  season text not null check (season in ('spring', 'summer', 'autumn', 'winter')),
  year int not null check (year between 2000 and 2100),
  title text check (title is null or char_length(btrim(title)) between 1 and 120),
  enabled boolean not null default false,
  created_at timestamp with time zone default now(),
  unique (season, year)
);

alter table public.collections enable row level security;

-- Alle kan se en aktiveret kollektion; admin kan se dem alle (også deaktiverede)
create policy "Alle kan se aktiverede kollektioner"
  on public.collections for select
  using (enabled = true or public.is_admin());

create policy "Kun admin kan oprette kollektioner"
  on public.collections for insert
  to authenticated
  with check (public.is_admin());

create policy "Kun admin kan redigere kollektioner"
  on public.collections for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Kun admin kan slette kollektioner"
  on public.collections for delete
  to authenticated
  using (public.is_admin());

-- Hvilke udgivelser der ligger i hvilke kollektioner
create table public.collection_releases (
  id uuid default gen_random_uuid() primary key,
  collection_id uuid not null references public.collections(id) on delete cascade,
  release_id uuid not null references public.releases(id) on delete cascade,
  added_at timestamp with time zone default now(),
  unique (collection_id, release_id)
);

create index collection_releases_collection_id_idx on public.collection_releases (collection_id);
create index collection_releases_release_id_idx on public.collection_releases (release_id);

alter table public.collection_releases enable row level security;

create policy "Alle kan se udgivelser i aktiverede kollektioner"
  on public.collection_releases for select
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and (c.enabled = true or public.is_admin())
    )
  );

create policy "Kun admin kan tilføje udgivelser til kollektioner"
  on public.collection_releases for insert
  to authenticated
  with check (public.is_admin());

create policy "Kun admin kan fjerne udgivelser fra kollektioner"
  on public.collection_releases for delete
  to authenticated
  using (public.is_admin());
