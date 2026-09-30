-- ============================================
-- WE BUILT OTHER — opdatering 12
-- Globale til/fra-kontakter for køb (Stripe) og donationer, styret af admin.
-- Kør hele filen i Supabase: SQL Editor > New query > Run
-- Kør den lige efter den nye kode er lagt online på Vercel.
-- ============================================

create table public.app_settings (
  id int primary key default 1 check (id = 1),
  purchases_enabled boolean not null default true,
  donations_enabled boolean not null default true,
  updated_at timestamp with time zone default now()
);

insert into public.app_settings (id) values (1);

alter table public.app_settings enable row level security;

-- Alle skal kunne se indstillingerne (det er blot to til/fra-kontakter, ikke følsomme data)
create policy "Alle kan se globale indstillinger"
  on public.app_settings for select
  using (true);

create policy "Kun admin kan opdatere globale indstillinger"
  on public.app_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Donationer skal også kunne slås fra i selve databasen (køb via Stripe skrives af
-- serveren med fuld adgang, så den kontrol ligger i stedet i API-koden).
drop policy if exists "Man kan kun oprette donationskøb i eget navn" on public.purchases;

create policy "Man kan kun oprette donationskøb i eget navn, når det er aktiveret"
  on public.purchases for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and method in ('donation_ecf', 'donation_sweet_relief')
    and (select donations_enabled from public.app_settings where id = 1) = true
  );
