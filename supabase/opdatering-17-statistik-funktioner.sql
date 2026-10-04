-- ============================================
-- WE BUILT OTHER — opdatering 17
-- Funktioner, der regner tallene ud til admin-dashboardet (Statistik).
-- Alle funktioner kan KUN bruges af admin og ændrer intet — de læser kun.
-- Kør hele filen i Supabase: SQL Editor > New query > Run
-- Kør den FØR den nye kode lægges online (den er bagudkompatibel).
-- ============================================

-- Fælles regel for afspilninger: som standard tæller egne afspilninger (en publisher, der
-- lytter til sine egne numre) og admins afspilninger IKKE med. p_include_own = true tager dem med.

-- ---------- Overblik ----------
create or replace function public.admin_stats_overview(p_days integer default null, p_include_own boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := case when p_days is null then '-infinity'::timestamptz
                             else now() - make_interval(days => p_days) end;
begin
  if not public.is_admin() then
    raise exception 'Kun admin har adgang';
  end if;

  return jsonb_build_object(
    'days', p_days,
    'includeOwn', p_include_own,
    'eventsSince', (select min(pe.created_at) from public.play_events pe),
    'kpi', jsonb_build_object(
      'revenueCents', (select coalesce(sum(p.amount_cents), 0) from public.payments p
                        where p.currency = 'eur' and p.created_at >= v_from),
      'payments', (select count(*) from public.payments p where p.created_at >= v_from),
      'otherCurrencyPayments', (select count(*) from public.payments p
                                 where p.currency <> 'eur' and p.created_at >= v_from),
      'unlocks', (select count(*) from public.unlock_events u where u.created_at >= v_from),
      'unlocksPaid', (select count(*) from public.unlock_events u
                       where u.created_at >= v_from and u.method = 'stripe' and u.amount_cents > 0),
      'unlocksFree', (select count(*) from public.unlock_events u
                       where u.created_at >= v_from and u.method = 'stripe' and u.amount_cents = 0),
      'unlocksDonation', (select count(*) from public.unlock_events u
                           where u.created_at >= v_from and u.method like 'donation%'),
      'downloads', (select count(*) from public.download_events d where d.created_at >= v_from),
      'downloadsMp3', (select count(*) from public.download_events d where d.created_at >= v_from and d.format = 'mp3'),
      'downloadsFlac', (select count(*) from public.download_events d where d.created_at >= v_from and d.format = 'flac'),
      'playsPeriod', (select count(*) from public.play_events pe
                       where pe.created_at >= v_from
                         and (p_include_own or (not pe.own_play and coalesce(pe.listener_role, '') <> 'admin'))),
      'playsTotal', (select coalesce(sum(t.play_count), 0) from public.tracks t),
      'uniqueListeners', (select count(distinct pe.user_id) from public.play_events pe
                           where pe.created_at >= v_from
                             and (p_include_own or (not pe.own_play and coalesce(pe.listener_role, '') <> 'admin'))),
      'newUsers', (select count(*) from public.profiles pr where pr.created_at >= v_from),
      'pendingPublishers', (select count(*) from public.profiles pr
                             where pr.publisher_requested and pr.role = 'listener')
    ),
    'users', jsonb_build_object(
      'listeners', (select count(*) from public.profiles pr where pr.role = 'listener'),
      'publishers', (select count(*) from public.profiles pr where pr.role = 'publisher'),
      'admins', (select count(*) from public.profiles pr where pr.role = 'admin')
    ),
    'catalog', jsonb_build_object(
      'releases', (select count(*) from public.releases),
      'tracks', (select count(*) from public.tracks),
      'artists', (select count(*) from public.artists),
      'collections', (select count(*) from public.collections),
      'neverPlayed', (select count(*) from public.tracks t where t.play_count = 0)
    ),
    'sales', jsonb_build_object(
      'recent', (
        select coalesce(jsonb_agg(row_to_json(q)::jsonb order by q."createdAt" desc), '[]'::jsonb)
        from (
          select u.created_at as "createdAt", u.scope, u.method, u.amount_cents as "amountCents", u.currency,
                 u.release_id as "releaseId", u.collection_id as "collectionId",
                 r.title as "releaseTitle", c.title as "collectionTitle", c.season, c.year,
                 u.item_title as "fallbackTitle"
          from public.unlock_events u
          left join public.releases r on r.id = u.release_id
          left join public.collections c on c.id = u.collection_id
          where u.created_at >= v_from
          order by u.created_at desc
          limit 50
        ) q
      ),
      'byItem', (
        select coalesce(jsonb_agg(row_to_json(q)::jsonb order by q."revenueCents" desc, q.payments desc), '[]'::jsonb)
        from (
          select p.scope, p.release_id as "releaseId", p.collection_id as "collectionId",
                 r.title as "releaseTitle", c.title as "collectionTitle", c.season, c.year,
                 count(*) as payments, coalesce(sum(p.amount_cents), 0) as "revenueCents"
          from public.payments p
          left join public.releases r on r.id = p.release_id
          left join public.collections c on c.id = p.collection_id
          where p.currency = 'eur' and p.created_at >= v_from
          group by p.scope, p.release_id, p.collection_id, r.title, c.title, c.season, c.year
          order by "revenueCents" desc, payments desc
          limit 10
        ) q
      ),
      'buckets', (
        select jsonb_build_array(
          jsonb_build_object('key', 'free',     'count', count(*) filter (where s.amount_cents = 0)),
          jsonb_build_object('key', '0.5-0.99', 'count', count(*) filter (where s.amount_cents between 50 and 99)),
          jsonb_build_object('key', '1-1.99',   'count', count(*) filter (where s.amount_cents between 100 and 199)),
          jsonb_build_object('key', '2-4.99',   'count', count(*) filter (where s.amount_cents between 200 and 499)),
          jsonb_build_object('key', '5-9.99',   'count', count(*) filter (where s.amount_cents between 500 and 999)),
          jsonb_build_object('key', '10+',      'count', count(*) filter (where s.amount_cents >= 1000))
        )
        from (
          select u.amount_cents from public.unlock_events u
          where u.method = 'stripe' and u.created_at >= v_from
        ) s
      )
    ),
    'topTracks', (
      select coalesce(jsonb_agg(row_to_json(q)::jsonb), '[]'::jsonb)
      from (
        select t.id as "trackId", t.title, r.id as "releaseId", r.title as "releaseTitle",
               coalesce(a.name, '') as artist, t.play_count as "playsTotal", coalesce(e.n, 0) as "playsPeriod"
        from public.tracks t
        join public.releases r on r.id = t.release_id
        left join public.artists a on a.id = t.artist_id
        left join (
          select pe.track_id, count(*) as n from public.play_events pe
          where pe.created_at >= v_from
            and (p_include_own or (not pe.own_play and coalesce(pe.listener_role, '') <> 'admin'))
          group by pe.track_id
        ) e on e.track_id = t.id
        where t.play_count > 0 or coalesce(e.n, 0) > 0
        order by case when p_days is null then t.play_count else coalesce(e.n, 0) end desc,
                 t.play_count desc, t.title
        limit 10
      ) q
    ),
    'collections', (
      select coalesce(jsonb_agg(row_to_json(q)::jsonb order by q.year desc, q.season), '[]'::jsonb)
      from (
        select c.id as "collectionId", c.title, c.season, c.year, c.enabled,
               (select count(*) from public.collection_releases cr where cr.collection_id = c.id) as releases,
               (select count(*) from public.unlock_events u where u.collection_id = c.id and u.created_at >= v_from) as unlocks,
               (select coalesce(sum(p.amount_cents), 0) from public.payments p
                 where p.collection_id = c.id and p.currency = 'eur' and p.created_at >= v_from) as "revenueCents",
               (select count(*) from public.download_events d where d.collection_id = c.id and d.created_at >= v_from) as downloads
        from public.collections c
      ) q
    )
  );
end;
$$;

-- ---------- Tabellen over udgivelser ----------
create or replace function public.admin_stats_releases(p_days integer default null, p_include_own boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := case when p_days is null then '-infinity'::timestamptz
                             else now() - make_interval(days => p_days) end;
begin
  if not public.is_admin() then
    raise exception 'Kun admin har adgang';
  end if;

  return (
    select coalesce(jsonb_agg(row_to_json(q)::jsonb order by q."playsTotal" desc, q.title), '[]'::jsonb)
    from (
      select r.id as "releaseId", r.title, r.type, coalesce(a.name, '') as artist,
        (select coalesce(sum(t.play_count), 0) from public.tracks t where t.release_id = r.id) as "playsTotal",
        (select count(*) from public.play_events pe
          where pe.release_id = r.id and pe.created_at >= v_from
            and (p_include_own or (not pe.own_play and coalesce(pe.listener_role, '') <> 'admin'))) as "playsPeriod",
        (select count(*) from public.unlock_events u
          where u.scope = 'release' and u.release_id = r.id and u.created_at >= v_from) as "unlocksDirect",
        (select count(*) from public.unlock_events u
          where u.scope = 'collection' and u.created_at >= v_from
            and u.collection_id in (select cr.collection_id from public.collection_releases cr where cr.release_id = r.id)) as "unlocksViaCollection",
        (select coalesce(sum(p.amount_cents), 0) from public.payments p
          where p.scope = 'release' and p.release_id = r.id and p.currency = 'eur' and p.created_at >= v_from) as "revenueCents",
        (select count(*) from public.download_events d
          where d.scope = 'release' and d.release_id = r.id and d.created_at >= v_from) as "downloadsDirect",
        (select count(*) from public.download_events d
          where d.scope = 'collection' and d.created_at >= v_from
            and d.collection_id in (select cr.collection_id from public.collection_releases cr where cr.release_id = r.id)) as "downloadsViaCollection"
      from public.releases r
      left join public.artists a on a.id = r.artist_id
    ) q
  );
end;
$$;

-- ---------- Pr. dag (til de små søjlediagrammer) ----------
create or replace function public.admin_stats_daily(p_days integer default 30, p_include_own boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 90), 1), 365);
  v_today date := (now() at time zone 'Europe/Copenhagen')::date;
begin
  if not public.is_admin() then
    raise exception 'Kun admin har adgang';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'day', d.day,
      'plays', (select count(*) from public.play_events pe
                 where (pe.created_at at time zone 'Europe/Copenhagen')::date = d.day
                   and (p_include_own or (not pe.own_play and coalesce(pe.listener_role, '') <> 'admin'))),
      'unlocks', (select count(*) from public.unlock_events u
                   where (u.created_at at time zone 'Europe/Copenhagen')::date = d.day),
      'downloads', (select count(*) from public.download_events dl
                     where (dl.created_at at time zone 'Europe/Copenhagen')::date = d.day)
    ) order by d.day), '[]'::jsonb)
    from (select generate_series(v_today - (v_days - 1), v_today, interval '1 day')::date as day) d
  );
end;
$$;

-- ---------- Én udgivelse: numrene og deres afspilninger ----------
create or replace function public.admin_release_stats(p_release_id uuid, p_days integer default null, p_include_own boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := case when p_days is null then '-infinity'::timestamptz
                             else now() - make_interval(days => p_days) end;
  v_release jsonb;
begin
  if not public.is_admin() then
    raise exception 'Kun admin har adgang';
  end if;

  select jsonb_build_object(
    'id', r.id, 'title', r.title, 'type', r.type, 'genre', r.genre, 'createdAt', r.created_at,
    'artist', coalesce(a.name, ''), 'publisher', coalesce(pr.display_name, '')
  ) into v_release
  from public.releases r
  left join public.artists a on a.id = r.artist_id
  left join public.profiles pr on pr.id = r.publisher_id
  where r.id = p_release_id;

  if v_release is null then
    return null;
  end if;

  return jsonb_build_object(
    'days', p_days,
    'includeOwn', p_include_own,
    'eventsSince', (select min(pe.created_at) from public.play_events pe),
    'release', v_release,
    'totals', jsonb_build_object(
      'playsTotal', (select coalesce(sum(t.play_count), 0) from public.tracks t where t.release_id = p_release_id),
      'playsPeriod', (select count(*) from public.play_events pe
                       where pe.release_id = p_release_id and pe.created_at >= v_from
                         and (p_include_own or (not pe.own_play and coalesce(pe.listener_role, '') <> 'admin'))),
      'uniqueListeners', (select count(distinct pe.user_id) from public.play_events pe
                           where pe.release_id = p_release_id and pe.created_at >= v_from
                             and (p_include_own or (not pe.own_play and coalesce(pe.listener_role, '') <> 'admin'))),
      'unlocksDirect', (select count(*) from public.unlock_events u
                         where u.scope = 'release' and u.release_id = p_release_id and u.created_at >= v_from),
      'unlocksPaid', (select count(*) from public.unlock_events u
                       where u.scope = 'release' and u.release_id = p_release_id and u.created_at >= v_from
                         and u.method = 'stripe' and u.amount_cents > 0),
      'unlocksFree', (select count(*) from public.unlock_events u
                       where u.scope = 'release' and u.release_id = p_release_id and u.created_at >= v_from
                         and u.method = 'stripe' and u.amount_cents = 0),
      'unlocksDonation', (select count(*) from public.unlock_events u
                           where u.scope = 'release' and u.release_id = p_release_id and u.created_at >= v_from
                             and u.method like 'donation%'),
      'unlocksViaCollection', (select count(*) from public.unlock_events u
                                where u.scope = 'collection' and u.created_at >= v_from
                                  and u.collection_id in (select cr.collection_id from public.collection_releases cr where cr.release_id = p_release_id)),
      'revenueCents', (select coalesce(sum(p.amount_cents), 0) from public.payments p
                        where p.scope = 'release' and p.release_id = p_release_id and p.currency = 'eur' and p.created_at >= v_from),
      'downloadsDirect', (select count(*) from public.download_events d
                           where d.scope = 'release' and d.release_id = p_release_id and d.created_at >= v_from),
      'downloadsViaCollection', (select count(*) from public.download_events d
                                  where d.scope = 'collection' and d.created_at >= v_from
                                    and d.collection_id in (select cr.collection_id from public.collection_releases cr where cr.release_id = p_release_id))
    ),
    'tracks', (
      select coalesce(jsonb_agg(row_to_json(q)::jsonb order by q.position, q."createdAt"), '[]'::jsonb)
      from (
        select t.id as "trackId", t.title, t.position, t.created_at as "createdAt",
               coalesce(a.name, '') as artist, t.play_count as "playsTotal",
               (select count(*) from public.play_events pe
                 where pe.track_id = t.id and pe.created_at >= v_from
                   and (p_include_own or (not pe.own_play and coalesce(pe.listener_role, '') <> 'admin'))) as "playsPeriod",
               (select count(distinct pe.user_id) from public.play_events pe
                 where pe.track_id = t.id and pe.created_at >= v_from
                   and (p_include_own or (not pe.own_play and coalesce(pe.listener_role, '') <> 'admin'))) as "uniqueListeners"
        from public.tracks t
        left join public.artists a on a.id = t.artist_id
        where t.release_id = p_release_id
      ) q
    ),
    'recentUnlocks', (
      select coalesce(jsonb_agg(row_to_json(q)::jsonb order by q."createdAt" desc), '[]'::jsonb)
      from (
        select u.created_at as "createdAt", u.scope, u.method, u.amount_cents as "amountCents", u.currency,
               c.title as "collectionTitle", c.season, c.year
        from public.unlock_events u
        left join public.collections c on c.id = u.collection_id
        where u.created_at >= v_from
          and (
            (u.scope = 'release' and u.release_id = p_release_id)
            or (u.scope = 'collection' and u.collection_id in (select cr.collection_id from public.collection_releases cr where cr.release_id = p_release_id))
          )
        order by u.created_at desc
        limit 30
      ) q
    )
  );
end;
$$;

revoke all on function public.admin_stats_overview(integer, boolean) from public, anon;
revoke all on function public.admin_stats_releases(integer, boolean) from public, anon;
revoke all on function public.admin_stats_daily(integer, boolean) from public, anon;
revoke all on function public.admin_release_stats(uuid, integer, boolean) from public, anon;
grant execute on function public.admin_stats_overview(integer, boolean) to authenticated;
grant execute on function public.admin_stats_releases(integer, boolean) to authenticated;
grant execute on function public.admin_stats_daily(integer, boolean) to authenticated;
grant execute on function public.admin_release_stats(uuid, integer, boolean) to authenticated;
