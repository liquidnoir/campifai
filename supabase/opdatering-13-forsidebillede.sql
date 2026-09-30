-- ============================================
-- WE BUILT OTHER — opdatering 13
-- Admin kan selv uploade forsidebilledet og redigere hero-overskrift/brødtekst,
-- på både dansk og engelsk. Tomme felter falder tilbage til standardteksten i koden.
-- Kør hele filen i Supabase: SQL Editor > New query > Run
-- Kør den lige efter den nye kode er lagt online på Vercel.
-- ============================================

alter table public.app_settings add column hero_image_path text;
alter table public.app_settings add column hero_title_da text;
alter table public.app_settings add column hero_title_en text;
alter table public.app_settings add column hero_body_da text;
alter table public.app_settings add column hero_body_en text;
