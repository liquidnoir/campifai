-- ============================================
-- CAMPIFAI — opdatering 5
-- Tillader redigering af numre (titel/genre), som den nye
-- "Udgivelser"-side i dashboardet nu bruger.
-- Kør hele filen i Supabase: SQL Editor > New query > Run
-- Kør den lige efter den nye kode er lagt online på Vercel.
-- ============================================

create policy "Publishers kan opdatere egne numre"
  on public.tracks for update
  to authenticated
  using (publisher_id = (select auth.uid()))
  with check (publisher_id = (select auth.uid()));

create policy "Admin kan opdatere alle numre"
  on public.tracks for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
