-- ============================================
-- CAMPIFAI — opdatering 7
-- Genre flyttes fra numre til udgivelser (nedarves), og playlister tilføjes.
-- Kør hele filen i Supabase: SQL Editor > New query > Run
-- Kør den lige efter den nye kode er lagt online på Vercel.
-- ============================================

-- 1) Genre hører nu til udgivelsen, ikke det enkelte nummer
alter table public.releases add column genre text check (genre is null or char_length(genre) <= 60);

update public.releases r
set genre = (
  select nullif(btrim(t.genre), '')
  from public.tracks t
  where t.release_id = r.id and nullif(btrim(t.genre), '') is not null
  order by t.created_at
  limit 1
);

alter table public.tracks drop column genre;

-- 2) Playlister (private for ejeren)
create table public.playlists (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  created_at timestamp with time zone default now()
);

create index playlists_owner_id_idx on public.playlists (owner_id);

alter table public.playlists enable row level security;

create policy "Man kan kun se egne playlister"
  on public.playlists for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "Man kan kun oprette egne playlister"
  on public.playlists for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Man kan kun redigere egne playlister"
  on public.playlists for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Man kan kun slette egne playlister"
  on public.playlists for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- 3) Numre i en playliste
create table public.playlist_tracks (
  id uuid default gen_random_uuid() primary key,
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  added_at timestamp with time zone default now(),
  unique (playlist_id, track_id)
);

create index playlist_tracks_playlist_id_idx on public.playlist_tracks (playlist_id);

alter table public.playlist_tracks enable row level security;

create policy "Man kan kun se numre i egne playlister"
  on public.playlist_tracks for select
  to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = (select auth.uid())));

create policy "Man kan kun tilføje numre til egne playlister"
  on public.playlist_tracks for insert
  to authenticated
  with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = (select auth.uid())));

create policy "Man kan kun fjerne numre fra egne playlister"
  on public.playlist_tracks for delete
  to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = (select auth.uid())));
