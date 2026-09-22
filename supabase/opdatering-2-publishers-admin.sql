-- ============================================
-- CAMPIFAI — opdatering 2
-- Publishers, kunstnere (max 50 pr. publisher) og admin
-- Kør hele filen i Supabase: SQL Editor > New query > Run
-- Kør den lige efter den nye kode er lagt online på Vercel.
-- ============================================

-- 0) Roller: "artist" hedder nu "publisher", og der kommer en ny rolle "admin"
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'publisher' where role = 'artist';
alter table public.profiles
  add constraint profiles_role_check check (role in ('listener', 'publisher', 'admin'));

-- 1) Hjælpefunktioner
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.can_publish()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('publisher', 'admin')
  );
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.can_publish() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_publish() to authenticated;

-- 2) Profiler: kun lytter/publisher ved oprettelse, og kun admin kan ændre roller
drop policy if exists "Man kan kun oprette sin egen profil" on public.profiles;
create policy "Man kan kun oprette sin egen profil"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id and role in ('listener', 'publisher'));

drop policy if exists "Man kan kun opdatere sin egen profil" on public.profiles;
create policy "Man kan kun opdatere sin egen profil"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Admin kan opdatere alle profiler"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Kald uden bruger (fx fra SQL Editor) er altid tilladt
  if auth.uid() is not null and new.role is distinct from old.role then
    if not public.is_admin() then
      raise exception 'Kun en admin kan ændre roller';
    end if;
    if old.id = auth.uid() then
      raise exception 'Du kan ikke ændre din egen rolle';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- 3) Kunstnere (oprettes af en publisher, max 50 pr. publisher)
create table public.artists (
  id uuid default gen_random_uuid() primary key,
  publisher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  bio text check (bio is null or char_length(bio) <= 500),
  created_at timestamp with time zone default now()
);

create index artists_publisher_id_idx on public.artists (publisher_id);

alter table public.artists enable row level security;

create policy "Indloggede kan se kunstnere"
  on public.artists for select
  to authenticated
  using (true);

create policy "Publishers kan oprette egne kunstnere"
  on public.artists for insert
  to authenticated
  with check (publisher_id = (select auth.uid()) and public.can_publish());

create policy "Publishers kan redigere egne kunstnere"
  on public.artists for update
  to authenticated
  using (publisher_id = (select auth.uid()))
  with check (publisher_id = (select auth.uid()));

create policy "Publishers kan slette egne kunstnere"
  on public.artists for delete
  to authenticated
  using (publisher_id = (select auth.uid()));

create policy "Admin kan redigere alle kunstnere"
  on public.artists for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin kan slette alle kunstnere"
  on public.artists for delete
  to authenticated
  using (public.is_admin());

create or replace function public.limit_artists_per_publisher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.publisher_id = old.publisher_id then
    return new;
  end if;
  -- Lås publisherens profil, så to samtidige oprettelser ikke kan snyde grænsen
  perform 1 from public.profiles where id = new.publisher_id for update;
  if (select count(*) from public.artists where publisher_id = new.publisher_id) >= 50 then
    raise exception 'En publisher kan højst have 50 kunstnere';
  end if;
  return new;
end;
$$;

drop trigger if exists limit_artists_per_publisher on public.artists;
create trigger limit_artists_per_publisher
  before insert or update of publisher_id on public.artists
  for each row execute function public.limit_artists_per_publisher();

-- 4) Numre hører nu til en kunstner (og til den publisher, der uploadede dem)
alter table public.tracks add column publisher_id uuid;
update public.tracks set publisher_id = artist_id;  -- før var artist_id kontoens id

-- Hver eksisterende konto får én kunstner med samme navn og samme id,
-- så gamle links (/artist/...) og eksisterende numre stadig virker
insert into public.artists (id, publisher_id, name)
select p.id, p.id, left(btrim(p.display_name), 80)
from public.profiles p
where p.role = 'publisher'
   or p.id in (select artist_id from public.tracks)
on conflict (id) do nothing;

alter table public.tracks alter column publisher_id set not null;
alter table public.tracks drop constraint tracks_artist_id_fkey;
alter table public.tracks
  add constraint tracks_artist_id_fkey
  foreign key (artist_id) references public.artists(id) on delete cascade;
alter table public.tracks
  add constraint tracks_publisher_id_fkey
  foreign key (publisher_id) references public.profiles(id) on delete cascade;

create index tracks_artist_id_idx on public.tracks (artist_id);
create index tracks_publisher_id_idx on public.tracks (publisher_id);

drop policy if exists "Kunstnere kan kun uploade under eget navn" on public.tracks;
drop policy if exists "Kunstnere kan kun slette egne numre" on public.tracks;

create policy "Publishers kan uploade numre for egne kunstnere"
  on public.tracks for insert
  to authenticated
  with check (
    publisher_id = (select auth.uid())
    and exists (
      select 1 from public.artists a
      where a.id = artist_id and a.publisher_id = (select auth.uid())
    )
  );

create policy "Publishers kan slette egne numre"
  on public.tracks for delete
  to authenticated
  using (publisher_id = (select auth.uid()));

create policy "Admin kan slette alle numre"
  on public.tracks for delete
  to authenticated
  using (public.is_admin());

-- 5) Lydfiler: kun publishers kan uploade, og admin kan rydde op
drop policy if exists "Kunstnere kan kun uploade i egen mappe" on storage.objects;
create policy "Publishers kan kun uploade i egen mappe"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tracks'
    and (select auth.uid())::text = (storage.foldername(name))[1]
    and public.can_publish()
  );

create policy "Admin kan slette alle lydfiler"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'tracks' and public.is_admin());

-- 6) Admin-funktioner
create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  role text,
  display_name text,
  bio text,
  created_at timestamp with time zone,
  artist_count bigint,
  track_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Kun admin har adgang';
  end if;
  return query
  select
    p.id,
    u.email::text,
    p.role,
    p.display_name,
    p.bio,
    p.created_at,
    (select count(*) from public.artists a where a.publisher_id = p.id),
    (select count(*) from public.tracks t where t.publisher_id = p.id)
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_delete_user(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Kun admin har adgang';
  end if;
  if target = auth.uid() then
    raise exception 'Du kan ikke slette din egen konto her';
  end if;
  if exists (select 1 from public.profiles where id = target and role = 'admin') then
    raise exception 'Fjern først adminrollen, før du sletter en admin';
  end if;
  delete from auth.users where id = target;
end;
$$;

-- Slet egen konto (admin-konti kan ikke slettes her)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Ikke logget ind';
  end if;
  if public.is_admin() then
    raise exception 'Admin-konti kan ikke slettes her';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
