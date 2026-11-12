-- Palmer Ellites Hub Phase 3: professional writer profiles & assignments.
-- Run in PEH Supabase SQL Editor AFTER the initial supabase-schema.sql.
-- Public profiles are published only after verifying credentials and consent.

create table if not exists public.peh_writers (
 id uuid primary key default gen_random_uuid(),
 display_name text not null check (length(display_name) between 2 and 100),
 specialty text not null check (length(specialty) between 2 and 150),
 biography text not null default '' check (length(biography) <= 2000),
 skills text[] not null default '{}',
 qualifications text[] not null default '{}',
 achievements text[] not null default '{}',
 portfolio_links text[] not null default '{}',
 published boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.peh_writers enable row level security;
revoke all on public.peh_writers from anon;
grant select on public.peh_writers to anon, authenticated;
grant insert, update, delete on public.peh_writers to authenticated;

drop policy if exists "public view published writers" on public.peh_writers;
create policy "public view published writers" on public.peh_writers
 for select to anon,authenticated
 using (published = true);
drop policy if exists "admins view all writers" on public.peh_writers;
create policy "admins view all writers" on public.peh_writers
 for select to authenticated using (
  exists(select 1 from public.peh_admins a where a.user_id=(select auth.uid()))
 );
drop policy if exists "admins insert writers" on public.peh_writers;
create policy "admins insert writers" on public.peh_writers
 for insert to authenticated with check (
   exists(select 1 from public.peh_admins a where a.user_id=(select auth.uid()))
 );
drop policy if exists "admins update writers" on public.peh_writers;
create policy "admins update writers" on public.peh_writers
 for update to authenticated
 using (exists(select 1 from public.peh_admins a where a.user_id=(select auth.uid())))
 with check (exists(select 1 from public.peh_admins a where a.user_id=(select auth.uid())));
drop policy if exists "admins delete writers" on public.peh_writers;
create policy "admins delete writers" on public.peh_writers
 for delete to authenticated using (
   exists(select 1 from public.peh_admins a where a.user_id=(select auth.uid()))
 );

alter table public.orders add column if not exists assigned_writer_id uuid references public.peh_writers(id) on delete set null;
-- This column is read-only to students; an authorized admin can change it.
grant update (assigned_writer_id) on public.orders to authenticated;

-- The orders RLS admin policy installed in Phase 2 applies to the assignment.
-- Payment status is never changed by this writer-assignment workflow.
-- A future writer login portal requires separate authenticated writer role policies;
-- the public profile is NOT a login account and cannot see customers' private orders.
