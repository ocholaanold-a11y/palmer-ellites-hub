-- PEH Phase 5: authenticated revision requests on existing customer orders.
-- Run this script using postgres in your Supabase SQL Editor.
-- This is additive; existing orders and private file policies remain unchanged.

create table if not exists public.peh_revisions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  instructions text not null check (char_length(trim(instructions)) between 10 and 3000),
  status text not null default 'requested'
    check (status in ('requested','in_review','accepted','completed','declined')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists peh_revisions_order_created_idx
  on public.peh_revisions (order_id,created_at desc);
alter table public.peh_revisions enable row level security;
revoke all on public.peh_revisions from anon;
grant select,insert to authenticated on public.peh_revisions;
grant update (status,admin_note) to authenticated on public.peh_revisions;

drop policy if exists "student and admin read revisions" on public.peh_revisions;
create policy "student and admin read revisions"
on public.peh_revisions for select to authenticated
using (
  exists(select 1 from public.orders o
    where o.id=order_id and o.user_id=(select auth.uid()))
  or exists(select 1 from public.peh_admins a
    where a.user_id=(select auth.uid()))
);

drop policy if exists "student request revision" on public.peh_revisions;
create policy "student request revision"
on public.peh_revisions for insert to authenticated
with check (
  requested_by=(select auth.uid())
  and status='requested'
  and admin_note is null
  and exists(select 1 from public.orders o
    where o.id=order_id
      and o.user_id=(select auth.uid())
      and o.status in ('review','delivered'))
);

drop policy if exists "admin update revision" on public.peh_revisions;
create policy "admin update revision"
on public.peh_revisions for update to authenticated
using (exists(select 1 from public.peh_admins a where a.user_id=(select auth.uid())))
with check (exists(select 1 from public.peh_admins a where a.user_id=(select auth.uid())));

create or replace function public.peh_revisions_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at=now(); return new; end $$;

drop trigger if exists peh_revisions_timestamp on public.peh_revisions;
create trigger peh_revisions_timestamp
before update on public.peh_revisions
for each row execute function public.peh_revisions_updated_at();

-- No privileged function exposes client data; the existing private storage
-- RLS permits admins to upload an object to an existing customer's order folder.
-- A writer login/assignment does not automatically confer customer access.
