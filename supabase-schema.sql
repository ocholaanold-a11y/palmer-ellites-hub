-- Palmer Ellites Hub (PEH): initial secure student order and admin foundations.
-- Run in Supabase SQL editor, on a NEW database before production use.
-- Review migration strategy before applying to an existing database.
create extension if not exists pgcrypto;

create table if not exists public.peh_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.peh_admins enable row level security;
revoke all on public.peh_admins from anon;
grant select on public.peh_admins to authenticated;
drop policy if exists "admins can see own membership" on public.peh_admins;
create policy "admins can see own membership" on public.peh_admins
  for select to authenticated using (user_id = (select auth.uid()));
-- SECURITY: The site never allows a client to insert or update peh_admins.
-- Add an administrator only with the SQL editor using a verified auth.users ID.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service text not null check (char_length(service) between 2 and 120),
  description text not null check (char_length(description) between 20 and 3000),
  deadline timestamptz not null,
  contact_email text not null,
  preferred_writer text,
  requested_currency text not null default 'USD' check (requested_currency ~ '^[A-Z]{3}$'),
  quote_amount numeric(12,2) check (quote_amount is null or quote_amount >= 0),
  status text not null default 'submitted'
    check (status in ('submitted','quoted','awaiting_payment','paid','assigned','in_progress','review','delivered','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_created_idx on public.orders(user_id,created_at desc);
create index if not exists orders_status_created_idx on public.orders(status,created_at desc);
alter table public.orders enable row level security;
revoke all on public.orders from anon;
grant select, insert on public.orders to authenticated;
-- Limit browser-originated admin updates to quote/status only. Clients still
-- cannot UPDATE because RLS does not grant them an update policy.
grant update (status, quote_amount) on public.orders to authenticated;

drop policy if exists "client can read own orders" on public.orders;
create policy "client can read own orders" on public.orders
  for select to authenticated
  using ((select auth.uid()) = user_id or exists
    (select 1 from public.peh_admins a where a.user_id = (select auth.uid())));

drop policy if exists "client submit initial request" on public.orders;
create policy "client submit initial request" on public.orders
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id and status = 'submitted'
    and quote_amount is null
  );

-- Authorized admins can quote and move non-paid orders through review stages.
-- "paid" is excluded as a destination: payment confirmation must come from
-- an independently verified server-side provider webhook, not browser data.
drop policy if exists "admin manage project statuses" on public.orders;
create policy "admin manage project statuses" on public.orders
  for update to authenticated
  using (exists (select 1 from public.peh_admins a where a.user_id = (select auth.uid())))
  with check (status <> 'paid' and exists
    (select 1 from public.peh_admins a where a.user_id = (select auth.uid())));

-- Optional updated_at trigger.
create or replace function public.peh_set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists peh_orders_updated_at on public.orders;
create trigger peh_orders_updated_at before update on public.orders
  for each row execute function public.peh_set_updated_at();

-- To authorize an existing verified user as PEH admin, run separately:
-- insert into public.peh_admins(user_id) values ('ACTUAL_AUTH_USER_UUID');
-- NEVER give the public site service_role keys or raw card information.
