-- Palmer Ellites Hub: secure authenticated writer accounts and private drafts.
-- Run as postgres in Supabase SQL Editor AFTER the core, writers and storage migrations.
-- Writer profiles are NOT login accounts until linked by an administrator.

create table if not exists public.peh_writer_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  writer_id uuid unique not null references public.peh_writers(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.peh_writer_accounts enable row level security;
revoke all on public.peh_writer_accounts from anon;
grant select, insert, update, delete on public.peh_writer_accounts to authenticated;

drop policy if exists "peh writer account membership" on public.peh_writer_accounts;
create policy "peh writer account membership" on public.peh_writer_accounts
  for select to authenticated
  using (
    user_id=(select auth.uid()) or exists(
      select 1 from public.peh_admins a where a.user_id=(select auth.uid())
    )
  );

drop policy if exists "peh admins link writers" on public.peh_writer_accounts;
create policy "peh admins link writers" on public.peh_writer_accounts
  for insert to authenticated
  with check (exists(
    select 1 from public.peh_admins a where a.user_id=(select auth.uid())
  ));

drop policy if exists "peh admins update writer links" on public.peh_writer_accounts;
create policy "peh admins update writer links" on public.peh_writer_accounts
  for update to authenticated
  using (exists(
    select 1 from public.peh_admins a where a.user_id=(select auth.uid())
  ))
  with check (exists(
    select 1 from public.peh_admins a where a.user_id=(select auth.uid())
  ));

drop policy if exists "peh admins remove writer links" on public.peh_writer_accounts;
create policy "peh admins remove writer links" on public.peh_writer_accounts
  for delete to authenticated using (exists(
    select 1 from public.peh_admins a where a.user_id=(select auth.uid())
  ));

-- Server-verified project listing. Does not expose customer email or pricing.
create or replace function public.peh_get_my_writer_projects()
returns table (
  id uuid, user_id uuid, service text, description text,
  deadline timestamptz, status text, created_at timestamptz
)
language sql security definer stable set search_path = ''
as $$
  select o.id, o.user_id, o.service, o.description, o.deadline, o.status, o.created_at
  from public.orders o
  join public.peh_writer_accounts wa on wa.writer_id = o.assigned_writer_id
  where wa.user_id = (select auth.uid())
  order by o.created_at desc
  limit 50;
$$;
revoke all on function public.peh_get_my_writer_projects() from public;
grant execute on function public.peh_get_my_writer_projects() to authenticated;

-- Verify access without granting writers direct SELECT on all orders.
create or replace function public.peh_writer_can_access_file(
  p_owner uuid, p_order uuid, p_upload boolean default false
)
returns boolean
language sql security definer stable set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    join public.peh_writer_accounts wa on wa.writer_id = o.assigned_writer_id
    where wa.user_id = (select auth.uid())
      and o.id = p_order and o.user_id = p_owner
      and (not p_upload or o.status <> 'cancelled')
  );
$$;
revoke all on function public.peh_writer_can_access_file(uuid,uuid,boolean) from public;
grant execute on function public.peh_writer_can_access_file(uuid,uuid,boolean) to authenticated;

-- Separate staff drafts bucket. Students never receive read access to it.
insert into storage.buckets(id,name,public,file_size_limit)
values('peh-writer-drafts','peh-writer-drafts',false,52428800)
on conflict (id) do update
  set public=false, file_size_limit=52428800;

drop policy if exists "peh writers read drafts" on storage.objects;
create policy "peh writers read drafts" on storage.objects
  for select to authenticated using (
    bucket_id='peh-writer-drafts'
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
    and (
      public.peh_writer_can_access_file(
        ((storage.foldername(name))[1])::uuid,
        ((storage.foldername(name))[2])::uuid, false
      )
      or exists (select 1 from public.peh_admins a where a.user_id=(select auth.uid()))
    )
  );

drop policy if exists "peh assigned writers submit drafts" on storage.objects;
create policy "peh assigned writers submit drafts" on storage.objects
  for insert to authenticated with check (
    bucket_id='peh-writer-drafts'
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
    and storage.filename(name) like 'DRAFT-%'
    and public.peh_writer_can_access_file(
      ((storage.foldername(name))[1])::uuid,
      ((storage.foldername(name))[2])::uuid, true
    )
  );

-- Allow assigned writers to read source files in the customer order bucket.
drop policy if exists "peh assigned writers read order files" on storage.objects;
create policy "peh assigned writers read order files" on storage.objects
  for select to authenticated using (
    bucket_id='peh-order-files'
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
    and public.peh_writer_can_access_file(
      ((storage.foldername(name))[1])::uuid,
      ((storage.foldername(name))[2])::uuid, false
    )
  );

-- Prevent direct writer uploads to the customer-visible bucket.
drop policy if exists "peh assigned writers upload drafts" on storage.objects;
-- No writer permission to change order status, payment, quote, or customer details.
