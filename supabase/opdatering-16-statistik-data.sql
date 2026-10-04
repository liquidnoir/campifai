-- ============================================
-- WE BUILT OTHER — opdatering 16
-- Data til admin-dashboardet:
--  1) Oplåsninger: permanent log over hver gang nogen låser download op
--     (betalt, GRATIS = 0 EUR, eller donation)
--  2) Afspilninger: hver afspilning logges med tidspunkt (tælleren bevares)
--  3) Downloads: hver gennemført download logges med format
-- Alt er kun læsbart for admin. Ved sletning af en bruger anonymiseres rækkerne
-- (bruger sættes til tom), så tallene består.
-- Kør hele filen i Supabase: SQL Editor > New query > Run
-- Kør den FØR den nye kode lægges online (den er bagudkompatibel).
-- ============================================

-- ---------- 1) Oplåsninger ----------
create table public.unlock_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  user_id uuid references public.profiles(id) on delete set null,
  scope text not null check (scope in ('release', 'collection')),
  release_id uuid references public.releases(id) on delete set null,
  collection_id uuid references public.collections(id) on delete set null,
  item_title text,                 -- titlen på det tidspunkt, så den kan vises, selv hvis varen slettes
  method text not null,            -- stripe | donation_ecf | donation_sweet_relief
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
                                   -- null = ukendt beløb (donation), 0 = gratis, over 0 = betalt
  currency text,
  stripe_session_id text unique
);

create index unlock_events_created_at_idx on public.unlock_events (created_at);
create index unlock_events_release_idx on public.unlock_events (release_id);
create index unlock_events_collection_idx on public.unlock_events (collection_id);

alter table public.unlock_events enable row level security;

create policy "Kun admin kan se oplåsninger"
  on public.unlock_events for select
  to authenticated
  using (public.is_admin());

-- Hver ny adgang (purchases) logges automatisk, uanset om den kommer fra en donation
-- (browseren) eller et Stripe-køb (serveren). Beløbet hentes fra betalingen; findes der
-- ingen betaling for et Stripe-køb, var det gratis (0 EUR).
create or replace function public.log_unlock_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_amount integer;
  v_currency text;
  v_session text;
begin
  if new.scope = 'release' then
    select r.title into v_title from public.releases r where r.id = new.release_id;
  else
    select coalesce(nullif(trim(c.title), ''), initcap(c.season) || ' ' || c.year::text)
      into v_title
      from public.collections c where c.id = new.collection_id;
  end if;

  if new.method = 'stripe' then
    select p.amount_cents, p.currency, p.stripe_session_id
      into v_amount, v_currency, v_session
      from public.payments p
      where p.user_id = new.user_id
        and p.scope = new.scope
        and p.release_id is not distinct from new.release_id
        and p.collection_id is not distinct from new.collection_id
      order by p.created_at desc
      limit 1;
    if not found then
      v_amount := 0;
      v_currency := 'eur';
      v_session := null;
    end if;
  end if;

  insert into public.unlock_events
    (user_id, scope, release_id, collection_id, item_title, method, amount_cents, currency, stripe_session_id)
  values
    (new.user_id, new.scope, new.release_id, new.collection_id, v_title, new.method, v_amount, v_currency, v_session)
  on conflict (stripe_session_id) do nothing;

  return null;
end;
$$;

create trigger log_unlock_event
  after insert on public.purchases
  for each row execute function public.log_unlock_event();

-- Eksisterende historik: betalinger, donationer og gratis køb
insert into public.unlock_events
  (created_at, user_id, scope, release_id, collection_id, item_title, method, amount_cents, currency, stripe_session_id)
select
  pay.created_at, pay.user_id, pay.scope, pay.release_id, pay.collection_id,
  case when pay.scope = 'release' then r.title
       else coalesce(nullif(trim(c.title), ''), initcap(c.season) || ' ' || c.year::text) end,
  'stripe', pay.amount_cents, pay.currency, pay.stripe_session_id
from public.payments pay
left join public.releases r on r.id = pay.release_id
left join public.collections c on c.id = pay.collection_id
on conflict (stripe_session_id) do nothing;

insert into public.unlock_events
  (created_at, user_id, scope, release_id, collection_id, item_title, method, amount_cents, currency)
select
  pr.created_at, pr.user_id, pr.scope, pr.release_id, pr.collection_id,
  case when pr.scope = 'release' then r.title
       else coalesce(nullif(trim(c.title), ''), initcap(c.season) || ' ' || c.year::text) end,
  pr.method,
  case when pr.method = 'stripe' then 0 end,
  case when pr.method = 'stripe' then 'eur' end
from public.purchases pr
left join public.releases r on r.id = pr.release_id
left join public.collections c on c.id = pr.collection_id
where pr.method <> 'stripe'
   or not exists (
        select 1 from public.payments pay
        where pay.user_id = pr.user_id and pay.scope = pr.scope
          and pay.release_id is not distinct from pr.release_id
          and pay.collection_id is not distinct from pr.collection_id
      );

-- ---------- 2) Afspilninger ----------
create table public.play_events (
  id bigint generated always as identity primary key,
  created_at timestamp with time zone not null default now(),
  track_id uuid references public.tracks(id) on delete set null,
  release_id uuid references public.releases(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  listener_role text,                          -- lytterens rolle på det tidspunkt
  own_play boolean not null default false      -- lytteren er selv nummerets publisher
);

create index play_events_created_at_idx on public.play_events (created_at);
create index play_events_track_idx on public.play_events (track_id);
create index play_events_release_idx on public.play_events (release_id);

alter table public.play_events enable row level security;

create policy "Kun admin kan se afspilninger"
  on public.play_events for select
  to authenticated
  using (public.is_admin());

-- Samme funktion og samme kald som før (tælleren på nummeret bevares), men nu logges også
-- en hændelse. Kun indloggede afspilninger tæller, og samme bruger og nummer inden for
-- 30 sekunder tæller kun én gang (så hurtige skift frem og tilbage ikke blæser tallet op).
create or replace function public.increment_play_count(track_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_track uuid := track_id;
  v_user uuid := (select auth.uid());
  v_release uuid;
  v_publisher uuid;
  v_role text;
begin
  if v_user is null then
    return;
  end if;

  select t.release_id, t.publisher_id into v_release, v_publisher
    from public.tracks t where t.id = v_track;
  if not found then
    return;
  end if;

  if exists (
    select 1 from public.play_events pe
    where pe.track_id = v_track and pe.user_id = v_user
      and pe.created_at > now() - interval '30 seconds'
  ) then
    return;
  end if;

  update public.tracks t set play_count = t.play_count + 1 where t.id = v_track;

  select p.role into v_role from public.profiles p where p.id = v_user;

  insert into public.play_events (track_id, release_id, user_id, listener_role, own_play)
  values (v_track, v_release, v_user, v_role, v_user = v_publisher);
end;
$$;

-- ---------- 3) Downloads ----------
create table public.download_events (
  id bigint generated always as identity primary key,
  created_at timestamp with time zone not null default now(),
  user_id uuid references public.profiles(id) on delete set null,
  scope text not null check (scope in ('release', 'collection')),
  release_id uuid references public.releases(id) on delete set null,
  collection_id uuid references public.collections(id) on delete set null,
  item_title text,
  format text not null check (format in ('mp3', 'flac')),
  track_count integer
);

create index download_events_created_at_idx on public.download_events (created_at);
create index download_events_release_idx on public.download_events (release_id);
create index download_events_collection_idx on public.download_events (collection_id);

alter table public.download_events enable row level security;

create policy "Kun admin kan se downloads"
  on public.download_events for select
  to authenticated
  using (public.is_admin());

-- Kaldes af browseren, når en download er gennemført. Logger kun, hvis brugeren faktisk
-- har adgang (køb, kollektionsadgang, egen udgivelse eller admin), og aldrig fejl —
-- en mislykket log må aldrig forstyrre en download. Samme bruger, vare og format inden
-- for 10 sekunder tæller kun én gang.
create or replace function public.log_download(
  p_scope text,
  p_release_id uuid,
  p_collection_id uuid,
  p_format text,
  p_track_count integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_title text;
  v_ok boolean := false;
begin
  if v_user is null then
    return;
  end if;
  if p_scope not in ('release', 'collection') or p_format not in ('mp3', 'flac') then
    return;
  end if;

  if p_scope = 'release' then
    select r.title into v_title from public.releases r where r.id = p_release_id;
    if not found then
      return;
    end if;
    v_ok := public.is_admin()
      or exists (select 1 from public.releases r where r.id = p_release_id and r.publisher_id = v_user)
      or exists (select 1 from public.purchases pr where pr.user_id = v_user and pr.release_id = p_release_id)
      or exists (
        select 1 from public.purchases pr
        join public.collection_releases cr on cr.collection_id = pr.collection_id
        where pr.user_id = v_user and cr.release_id = p_release_id
      );
  else
    select coalesce(nullif(trim(c.title), ''), initcap(c.season) || ' ' || c.year::text)
      into v_title
      from public.collections c where c.id = p_collection_id;
    if not found then
      return;
    end if;
    v_ok := public.is_admin()
      or exists (select 1 from public.purchases pr where pr.user_id = v_user and pr.collection_id = p_collection_id);
  end if;
  if not v_ok then
    return;
  end if;

  if exists (
    select 1 from public.download_events d
    where d.user_id = v_user and d.scope = p_scope
      and d.release_id is not distinct from (case when p_scope = 'release' then p_release_id end)
      and d.collection_id is not distinct from (case when p_scope = 'collection' then p_collection_id end)
      and d.format = p_format
      and d.created_at > now() - interval '10 seconds'
  ) then
    return;
  end if;

  insert into public.download_events (user_id, scope, release_id, collection_id, item_title, format, track_count)
  values (
    v_user, p_scope,
    case when p_scope = 'release' then p_release_id end,
    case when p_scope = 'collection' then p_collection_id end,
    v_title, p_format, greatest(0, least(coalesce(p_track_count, 0), 1000))
  );
end;
$$;

revoke all on function public.log_download(text, uuid, uuid, text, integer) from public, anon;
grant execute on function public.log_download(text, uuid, uuid, text, integer) to authenticated;
