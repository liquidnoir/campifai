-- ============================================
-- WE BUILT OTHER — opdatering 20
-- Favoritter: en bruger kan markere numre med et hjerte. Kun ejeren kan se, tilføje og fjerne sine egne.
-- Kun additiv — kan køres, før den nye kode lægges online.
-- ============================================

create table if not exists public.favorites (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  primary key (user_id, track_id)
);

-- Hurtigt opslag af en brugers favoritter, nyeste først
create index if not exists favorites_user_created_idx on public.favorites (user_id, created_at desc);
-- Så sletning af et nummer ikke skal gennemsøge hele tabellen
create index if not exists favorites_track_idx on public.favorites (track_id);

alter table public.favorites enable row level security;

create policy "Man kan kun se egne favoritter"
  on public.favorites for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Man kan kun tilføje egne favoritter"
  on public.favorites for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Man kan kun fjerne egne favoritter"
  on public.favorites for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.favorites from anon;
grant select, insert, delete on public.favorites to authenticated;
