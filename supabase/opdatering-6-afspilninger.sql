-- ============================================
-- CAMPIFAI — opdatering 6
-- Afspilningstæller til "Mest spillede numre" på forsiden.
-- Kør hele filen i Supabase: SQL Editor > New query > Run
-- Kør den lige efter den nye kode er lagt online på Vercel.
-- ============================================

alter table public.tracks add column play_count integer not null default 0;

-- En snæver funktion, der KUN kan øge afspilningstælleren for ét nummer.
-- Bevidst adskilt fra den almindelige update-policy, så en lytter aldrig
-- kan ændre andre felter (titel, genre, m.m.) på andres numre.
create or replace function public.increment_play_count(track_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.tracks set play_count = play_count + 1 where id = track_id;
$$;

revoke all on function public.increment_play_count(uuid) from public, anon;
grant execute on function public.increment_play_count(uuid) to authenticated;
