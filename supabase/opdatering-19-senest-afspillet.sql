-- ============================================
-- WE BUILT OTHER — opdatering 19
-- "Senest afspillet" på forsiden: den indloggede brugers senest afspillede udgivelser.
-- Funktionen returnerer KUN brugerens egne afspilninger (afspilningstabellen er ellers kun
-- synlig for admin). Læser kun — kan køres, før den nye kode lægges online.
-- ============================================

-- Hurtigt opslag pr. bruger, også når tabellen vokser
create index if not exists play_events_user_idx on public.play_events (user_id, created_at desc);

-- De senest afspillede udgivelser, hver kun én gang, med seneste afspilningstidspunkt.
-- p_limit holdes mellem 1 og 30 (standard 10).
create or replace function public.my_recent_releases(p_limit integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 30);
begin
  if v_user is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(q)::jsonb order by q."lastPlayedAt" desc)
    from (
      select
        r.id as "releaseId",
        r.title,
        r.type,
        r.cover_path as "coverPath",
        r.color,
        a.name as artist,
        x.last_played as "lastPlayedAt"
      from (
        select pe.release_id, max(pe.created_at) as last_played
        from public.play_events pe
        where pe.user_id = v_user and pe.release_id is not null
        group by pe.release_id
        order by max(pe.created_at) desc
        limit v_limit
      ) x
      join public.releases r on r.id = x.release_id
      left join public.artists a on a.id = r.artist_id
    ) q
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.my_recent_releases(integer) from public, anon;
grant execute on function public.my_recent_releases(integer) to authenticated;
