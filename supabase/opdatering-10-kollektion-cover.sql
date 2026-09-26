-- ============================================
-- CAMPIFAI — opdatering 10
-- Cover art til kollektioner (samme mønster som udgivelser).
-- Kør hele filen i Supabase: SQL Editor > New query > Run
-- Kør den lige efter den nye kode er lagt online på Vercel.
-- ============================================

alter table public.collections add column cover_path text;
