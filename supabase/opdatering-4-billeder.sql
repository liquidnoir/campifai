-- ============================================
-- CAMPIFAI — opdatering 4
-- Cover art til udgivelser, billede til kunstnere,
-- forside med udgivelser + alle kunstnere.
-- Kør hele filen i Supabase: SQL Editor > New query > Run
-- Kør den lige efter den nye kode er lagt online på Vercel.
-- ============================================

-- 1) Felter til billedsti (selve filen ligger i Storage-bucketten "images")
alter table public.artists add column image_path text;
alter table public.releases add column cover_path text;

-- 2) Ny, offentlig bucket til billeder (adskilt fra den private "tracks"-bucket)
insert into storage.buckets (id, name, public, file_size_limit)
values ('images', 'images', true, 5242880) -- 5 MB pr. billede
on conflict (id) do nothing;

create policy "Alle kan se billeder"
  on storage.objects for select
  using (bucket_id = 'images');

create policy "Publishers kan uploade billeder i egen mappe"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'images'
    and (select auth.uid())::text = (storage.foldername(name))[1]
    and public.can_publish()
  );

create policy "Publishers kan opdatere egne billeder"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'images' and (select auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'images' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy "Publishers kan slette egne billeder"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'images' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy "Admin kan slette alle billeder"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'images' and public.is_admin());

-- 3) Kun ejeren (eller admin) må sætte billedsti på egen kunstner/udgivelse.
-- (De almindelige update-policyer for artists/releases dækker allerede dette,
-- da image_path/cover_path bare er endnu et felt på de samme rækker.)
