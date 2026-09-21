-- ============================================
-- RILLE — database-opsætning
-- Kør hele denne fil i Supabase: SQL Editor > New query > Run
-- ============================================

-- Profiler (både kunstnere og lyttere)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  role text not null check (role in ('artist','listener')),
  display_name text not null,
  bio text,
  created_at timestamp with time zone default now()
);

alter table profiles enable row level security;

create policy "Alle kan se profiler"
  on profiles for select
  using (true);

create policy "Man kan kun oprette sin egen profil"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Man kan kun opdatere sin egen profil"
  on profiles for update
  using (auth.uid() = id);

-- Numre
create table tracks (
  id uuid default gen_random_uuid() primary key,
  artist_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  genre text,
  audio_path text not null,
  color text default '#B8452B',
  created_at timestamp with time zone default now()
);

alter table tracks enable row level security;

create policy "Alle kan se numre"
  on tracks for select
  using (true);

create policy "Kunstnere kan kun uploade under eget navn"
  on tracks for insert
  with check (auth.uid() = artist_id);

create policy "Kunstnere kan kun slette egne numre"
  on tracks for delete
  using (auth.uid() = artist_id);

-- ============================================
-- Storage: opret bucket "tracks" manuelt under Storage i Supabase
-- (marker den som "Public bucket"), kør derefter dette:
-- ============================================

create policy "Alle kan læse lydfiler"
  on storage.objects for select
  using (bucket_id = 'tracks');

create policy "Kunstnere kan kun uploade i egen mappe"
  on storage.objects for insert
  with check (
    bucket_id = 'tracks'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Kunstnere kan kun slette i egen mappe"
  on storage.objects for delete
  using (
    bucket_id = 'tracks'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
