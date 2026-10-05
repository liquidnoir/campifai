-- ============================================
-- WE BUILT OTHER — opdatering 18
-- "Mine køb": funktioner, der kun returnerer den indloggede brugers egne køb og kvitteringer.
-- Læser kun — ændrer intet. Kan køres, før den nye kode lægges online.
-- ============================================

-- Alle brugerens køb og oplåsninger, nyeste først. For hvert køb: hvad det var, hvornår,
-- hvordan (betalt, gratis eller donation) og beløbet. Et Stripe-køb uden betaling er gratis (0).
create or replace function public.my_purchases()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(q)::jsonb order by q."createdAt" desc)
    from (
      select
        pr.id as "purchaseId",
        pr.scope,
        pr.method,
        pr.created_at as "createdAt",
        pr.release_id as "releaseId",
        pr.collection_id as "collectionId",
        r.title as "releaseTitle",
        r.type as "releaseType",
        r.cover_path as "releaseCover",
        a.name as artist,
        c.title as "collectionTitle",
        c.season,
        c.year,
        c.enabled as "collectionEnabled",
        c.cover_path as "collectionCover",
        (select count(*) from public.collection_releases cr where cr.collection_id = pr.collection_id) as "releaseCount",
        coalesce(pay.amount_cents, case when pr.method = 'stripe' then 0 end) as "amountCents",
        coalesce(pay.currency, case when pr.method = 'stripe' then 'eur' end) as currency,
        pay.id as "paymentId"
      from public.purchases pr
      left join public.releases r on r.id = pr.release_id
      left join public.artists a on a.id = r.artist_id
      left join public.collections c on c.id = pr.collection_id
      left join lateral (
        select p.id, p.amount_cents, p.currency
        from public.payments p
        where p.user_id = pr.user_id
          and p.scope = pr.scope
          and p.release_id is not distinct from pr.release_id
          and p.collection_id is not distinct from pr.collection_id
        order by p.created_at desc
        limit 1
      ) pay on true
      where pr.user_id = v_user
    ) q
  ), '[]'::jsonb);
end;
$$;

-- Kvittering for én betaling. Returnerer tomt, hvis betalingen ikke er brugerens egen.
create or replace function public.my_receipt(p_payment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    return null;
  end if;

  return (
    select jsonb_build_object(
      'paymentId', p.id,
      'reference', upper(left(replace(p.id::text, '-', ''), 8)),
      'createdAt', p.created_at,
      'amountCents', p.amount_cents,
      'currency', p.currency,
      'scope', p.scope,
      'releaseTitle', r.title,
      'artist', a.name,
      'collectionTitle', c.title,
      'season', c.season,
      'year', c.year,
      'buyerName', pf.display_name,
      'buyerEmail', u.email
    )
    from public.payments p
    left join public.releases r on r.id = p.release_id
    left join public.artists a on a.id = r.artist_id
    left join public.collections c on c.id = p.collection_id
    left join public.profiles pf on pf.id = p.user_id
    left join auth.users u on u.id = p.user_id
    where p.id = p_payment_id and p.user_id = v_user
  );
end;
$$;

revoke all on function public.my_purchases() from public, anon;
revoke all on function public.my_receipt(uuid) from public, anon;
grant execute on function public.my_purchases() to authenticated;
grant execute on function public.my_receipt(uuid) to authenticated;
