-- ============================================
-- WE BUILT OTHER — opdatering 14
--  1) Rækkefølge på numre i en udgivelse
--  2) Kunstner pr. nummer (arves fra udgivelsen, kan ændres)
--  3) Publisher-adgang skal godkendes af en admin
-- Kør hele filen i Supabase: SQL Editor > New query > Run
-- Kør den lige efter den nye kode er lagt online på Vercel.
-- ============================================

-- ---------- 1) Rækkefølge ----------
alter table public.tracks add column position integer;

update public.tracks t
set position = s.rn
from (
  select id, row_number() over (partition by release_id order by created_at, id) as rn
  from public.tracks
) s
where t.id = s.id;

alter table public.tracks alter column position set not null;
create index tracks_release_position_idx on public.tracks (release_id, position);

-- Omordner numrene i en udgivelse i ét atomisk skridt. Kun admin eller udgivelsens
-- egen publisher må, og listen skal indeholde præcis udgivelsens numre, hver én gang.
create or replace function public.set_release_track_order(p_release_id uuid, p_track_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publisher uuid;
  v_count int;
  v_distinct int;
  v_matching int;
begin
  select publisher_id into v_publisher from public.releases where id = p_release_id;
  if v_publisher is null then
    raise exception 'Udgivelsen findes ikke';
  end if;
  if not (public.is_admin() or v_publisher = (select auth.uid())) then
    raise exception 'Ingen adgang til at ændre rækkefølgen';
  end if;

  select count(*) into v_count from public.tracks where release_id = p_release_id;
  select count(distinct x) into v_distinct from unnest(p_track_ids) as x;
  select count(*) into v_matching from public.tracks
    where release_id = p_release_id and id = any(p_track_ids);

  if coalesce(array_length(p_track_ids, 1), 0) <> v_count
     or v_distinct <> v_count
     or v_matching <> v_count then
    raise exception 'Rækkefølgen skal indeholde præcis udgivelsens numre, hver én gang';
  end if;

  update public.tracks t
  set position = o.ord
  from unnest(p_track_ids) with ordinality as o(id, ord)
  where t.id = o.id and t.release_id = p_release_id;
end;
$$;

revoke all on function public.set_release_track_order(uuid, uuid[]) from public, anon;
grant execute on function public.set_release_track_order(uuid, uuid[]) to authenticated;

-- ---------- 2) Kunstner pr. nummer ----------
-- Et nummer arver udgivelsens kunstner, medmindre der angives en anden. En anden
-- kunstner skal tilhøre udgivelsens publisher (en admin må vælge frit).
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
  v_artist_publisher uuid;
begin
  select artist_id, publisher_id, type into v_artist_id, v_publisher_id, v_type
  from public.releases where id = new.release_id;

  if v_artist_id is null then
    raise exception 'Udgivelsen findes ikke';
  end if;

  new.publisher_id := v_publisher_id;

  if new.artist_id is null then
    new.artist_id := v_artist_id;
  elsif new.artist_id is distinct from v_artist_id then
    select publisher_id into v_artist_publisher from public.artists where id = new.artist_id;
    if v_artist_publisher is null then
      raise exception 'Kunstneren findes ikke';
    end if;
    if v_artist_publisher <> v_publisher_id and not public.is_admin() then
      raise exception 'Du kan kun vælge kunstnere, som tilhører udgivelsens publisher';
    end if;
  end if;

  if tg_op = 'INSERT' or new.release_id is distinct from old.release_id then
    -- Lås udgivelsen, så to samtidige uploads ikke kan snyde grænsen
    perform 1 from public.releases where id = new.release_id for update;
    select count(*) into v_count from public.tracks where release_id = new.release_id;
    if v_count >= public.release_track_limit(v_type) then
      raise exception 'Denne udgivelse har nået grænsen på % numre for typen %',
        public.release_track_limit(v_type), v_type;
    end if;
  end if;

  if tg_op = 'INSERT' and new.position is null then
    new.position := coalesce(
      (select max(position) from public.tracks where release_id = new.release_id), 0
    ) + 1;
  end if;

  return new;
end;
$$;

drop trigger if exists set_track_release_fields on public.tracks;
create trigger set_track_release_fields
  before insert or update of release_id, artist_id on public.tracks
  for each row execute function public.set_track_release_fields();

-- Skifter en udgivelses kunstner, følger de numre med, der arvede den gamle kunstner.
-- Numre med en selvvalgt anden kunstner røres ikke. Samtidig lukkes et hul: en publisher
-- kan kun vælge sine egne kunstnere til sine udgivelser (en admin må vælge frit).
create or replace function public.release_artist_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artist_publisher uuid;
begin
  select publisher_id into v_artist_publisher from public.artists where id = new.artist_id;
  if v_artist_publisher is null then
    raise exception 'Kunstneren findes ikke';
  end if;
  if v_artist_publisher <> new.publisher_id and not public.is_admin() then
    raise exception 'Du kan kun vælge kunstnere, som tilhører udgivelsens publisher';
  end if;

  update public.tracks
  set artist_id = new.artist_id
  where release_id = new.id and artist_id = old.artist_id;

  return null;
end;
$$;

drop trigger if exists release_artist_changed on public.releases;
create trigger release_artist_changed
  after update of artist_id on public.releases
  for each row
  when (old.artist_id is distinct from new.artist_id)
  execute function public.release_artist_changed();

-- ---------- 3) Publisher-godkendelse ----------
alter table public.profiles add column publisher_requested boolean not null default false;

-- Nye brugere oprettes altid som lyttere. Ønsker de at blive publisher, sættes
-- publisher_requested, og en admin skal godkende det (ændre rollen).
drop policy if exists "Man kan kun oprette sin egen profil" on public.profiles;
create policy "Man kan kun oprette sin egen profil som lytter"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id and role = 'listener');

-- Når en admin gør nogen til publisher/admin, er anmodningen afgjort
create or replace function public.clear_publisher_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role in ('publisher', 'admin') then
    new.publisher_requested := false;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_publisher_request on public.profiles;
create trigger clear_publisher_request
  before update of role on public.profiles
  for each row execute function public.clear_publisher_request();

-- Admins brugerliste skal vise, hvem der afventer godkendelse
drop function public.admin_list_users();
create function public.admin_list_users()
returns table(
  id uuid, email text, role text, display_name text, bio text,
  created_at timestamp with time zone,
  artist_count bigint, release_count bigint, track_count bigint,
  publisher_requested boolean
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
    (select count(*) from public.tracks t where t.publisher_id = p.id),
    p.publisher_requested
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated, service_role;
