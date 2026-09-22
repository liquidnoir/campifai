-- ============================================
-- CAMPIFAI — opdatering 3
-- Udgivelser (Album/EP/Single), "Udgivelser" i stedet for "Mit kontor",
-- og en offentlig forside uden afspilning.
-- Kør hele filen i Supabase: SQL Editor > New query > Run
-- Kør den lige efter den nye kode er lagt online på Vercel.
-- ============================================

-- 1) Udgivelser
create table public.releases (
  id uuid default gen_random_uuid() primary key,
  artist_id uuid not null references public.artists(id) on delete cascade,
  publisher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  type text not null check (type in ('album', 'ep', 'single')),
  color text default '#B8452B',
  created_at timestamp with time zone default now()
);

create index releases_artist_id_idx on public.releases (artist_id);
create index releases_publisher_id_idx on public.releases (publisher_id);

alter table public.releases enable row level security;

create policy "Alle kan se udgivelser"
  on public.releases for select
  using (true);

create policy "Publishers kan oprette udgivelser for egne kunstnere"
  on public.releases for insert
  to authenticated
  with check (
    publisher_id = (select auth.uid())
    and exists (select 1 from public.artists a where a.id = artist_id and a.publisher_id = (select auth.uid()))
  );

create policy "Publishers kan redigere egne udgivelser"
  on public.releases for update
  to authenticated
  using (publisher_id = (select auth.uid()))
  with check (publisher_id = (select auth.uid()));

create policy "Publishers kan slette egne udgivelser"
  on public.releases for delete
  to authenticated
  using (publisher_id = (select auth.uid()));

create policy "Admin kan redigere alle udgivelser"
  on public.releases for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin kan slette alle udgivelser"
  on public.releases for delete
  to authenticated
  using (public.is_admin());

-- Maks. antal numre pr. udgivelsestype
create or replace function public.release_track_limit(release_type text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case release_type
    when 'album' then 50
    when 'ep' then 6
    when 'single' then 1
    else 0
  end;
$$;

-- En udgivelses type må ikke ændres til noget, der er for lille til de numre, den allerede har
create or replace function public.check_release_type_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if new.type = old.type then
    return new;
  end if;
  select count(*) into v_count from public.tracks where release_id = new.id;
  if v_count > public.release_track_limit(new.type) then
    raise exception 'Udgivelsen har % numre, hvilket er for mange til typen %', v_count, new.type;
  end if;
  return new;
end;
$$;

drop trigger if exists check_release_type_change on public.releases;
create trigger check_release_type_change
  before update of type on public.releases
  for each row execute function public.check_release_type_change();

-- 2) Numre hører nu til en udgivelse; kunstner og publisher udledes automatisk deraf
alter table public.tracks add column release_id uuid;

create or replace function public.set_track_release_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artist_id uuid;
  v_publisher_id uuid;
  v_type text;
  v_count int;
begin
  select artist_id, publisher_id, type into v_artist_id, v_publisher_id, v_type
  from public.releases where id = new.release_id;

  if v_artist_id is null then
    raise exception 'Udgivelsen findes ikke';
  end if;

  new.artist_id := v_artist_id;
  new.publisher_id := v_publisher_id;

  if tg_op = 'INSERT' or new.release_id is distinct from old.release_id then
    -- Lås udgivelsen, så to samtidige uploads ikke kan snyde grænsen
    perform 1 from public.releases where id = new.release_id for update;
    select count(*) into v_count from public.tracks where release_id = new.release_id;
    if v_count >= public.release_track_limit(v_type) then
      raise exception 'Denne udgivelse har nået grænsen på % numre for typen %',
        public.release_track_limit(v_type), v_type;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists set_track_release_fields on public.tracks;
create trigger set_track_release_fields
  before insert or update of release_id on public.tracks
  for each row execute function public.set_track_release_fields();

-- Flyt eksisterende numre ind i en ny Single-udgivelse, så intet forsvinder
insert into public.releases (id, artist_id, publisher_id, title, type)
select gen_random_uuid(), t.artist_id, t.publisher_id, t.title, 'single'
from public.tracks t
where t.release_id is null;

with mapping as (
  select t.id as track_id, r.id as release_id
  from public.tracks t
  join public.releases r
    on r.artist_id = t.artist_id and r.publisher_id = t.publisher_id and r.title = t.title and r.type = 'single'
  where t.release_id is null
)
update public.tracks t set release_id = m.release_id
from mapping m where t.id = m.track_id;

alter table public.tracks alter column release_id set not null;
alter table public.tracks
  add constraint tracks_release_id_fkey
  foreign key (release_id) references public.releases(id) on delete cascade;

create index tracks_release_id_idx on public.tracks (release_id);

-- Upload-policyen tjekker nu udgivelsens ejer i stedet for kunstnerens
drop policy if exists "Publishers kan uploade numre for egne kunstnere" on public.tracks;
create policy "Publishers kan uploade numre til egne udgivelser"
  on public.tracks for insert
  to authenticated
  with check (
    exists (
      select 1 from public.releases r
      where r.id = release_id and r.publisher_id = (select auth.uid())
    )
  );

-- 3) Forsiden skal kunne læses af alle, uden at afsløre lydfiler
-- (storage.objects er stadig kun læsbar for indloggede, så afspilning kræver login)
drop policy if exists "Indloggede kan se numre" on public.tracks;
create policy "Alle kan se numre"
  on public.tracks for select
  using (true);

drop policy if exists "Indloggede kan se kunstnere" on public.artists;
create policy "Alle kan se kunstnere"
  on public.artists for select
  using (true);

-- 4) Admin-listen viser nu også antal udgivelser
drop function if exists public.admin_list_users();
create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  role text,
  display_name text,
  bio text,
  created_at timestamp with time zone,
  artist_count bigint,
  release_count bigint,
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
    (select count(*) from public.releases r where r.publisher_id = p.id),
    (select count(*) from public.tracks t where t.publisher_id = p.id)
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

grant execute on function public.admin_list_users() to authenticated;
