-- Palmer Ellites Hub: secure writer login associations and assignment-based access.
-- Run as POSTGRES only, after supabase-schema.sql, supabase-writers-migration.sql,
-- and supabase-storage-migration.sql. Existing order access policies stay intact.
-- Writer profiles do not automatically grant login rights.

create table if not exists public.peh_writer_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  writer_id uuid unique not null references public.peh_writers(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.peh_writer_accounts enable row level security;
revoke all on public.peh_writer_accounts from anon;
grant select,insert,update,delete on public.peh_writer_accounts to authenticated;

drop policy if exists "peh writer account membership" on public.peh_writer_accounts;
create policy "peh writer account membership"
on public.peh_writer_accounts for select to authenticated
using (user_id=(select auth.uid())
  or exists(select 1 from public.peh_admins a where a.user_id=(select auth.uid())));

drop policy if exists "peh admins link writers" on public.peh_writer_accounts;
create policy "peh admins link writers"
on public.peh_writer_accounts for insert to authenticated
with check (exists(select 1 from public.peh_admins a where a.user_id=(select auth.uid())));

drop policy if exists "peh admins update writer links" on public.peh_writer_accounts;
create policy "peh admins update writer links"
on public.peh_writer_accounts for update to authenticated
using (exists(select 1 from public.peh_admins a where a.user_id=(select auth.uid())))
with check (exists(select 1 from public.peh_admins a where a.user_id=(select auth.uid())));

drop policy if exists "peh admins remove writer links" on public.peh_writer_accounts;
create policy "peh admins remove writer links"
on public.peh_writer_accounts for delete to authenticated
using (exists(select 1 from public.peh_admins a where a.user_id=(select auth.uid())));

-- Only the minimum order information required for assigned work is returned.
-- Customer email and quotation are intentionally excluded.
create or replace function public.peh_get_my_writer_projects()
returns table(
  id uuid, user_id uuid, service text, description text,
  deadline timestamptz, status text, created_at timestamptz
)
language sql security definer stable set search_path=''
as $$
  select o.id,o.user_id,o.service,o.description,o.deadline,o.status,o.created_at
  from public.orders o
  join public.peh_writer_accounts wa on wa.writer_id=o.assigned_writer_id
  where wa.user_id=(select auth.uid())
  order by o.created_at desc
  limit 50;
$$;
revoke all on function public.peh_get_my_writer_projects() from public;
grant execute on function public.peh_get_my_writer_projects() to authenticated;

-- Storage RLS checks must not depend on an assigned writer having direct
-- SELECT permissions on the orders table. This definer safely verifies one
-- order and caller relationship without exposing other order data.
create or replace function public.peh_writer_can_access_file(
  p_owner uuid,p_order uuid,p_upload boolean default false
)
returns boolean language sql security definer stable set search_path=''
as $
  select exists(
    select 1 from public.orders o
    join public.peh_writer_accounts wa on wa.writer_id=o.assigned_writer_id
    where wa.user_id=(select auth.uid())
      and o.id=p_order and o.user_id=p_owner
      and (not p_upload or o.status <> 'cancelled')
  );
$;
revoke all on function public.peh_writer_can_access_file(uuid,uuid,boolean) from public;
grant execute on function public.peh_writer_can_access_file(uuid,uuid,boolean) to authenticated;

-- Assigned writers can view files for their orders. They cannot access any
-- unassigned order, and they cannot update/delete existing stored files.
drop policy if exists "peh assigned writers read order files" on storage.objects;
create policy "peh assigned writers read order files"
on storage.objects for select to authenticated using(
  bucket_id='peh-order-files'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}
);

-- Writer-created files must be prefixed DELIVERED- for easier distinction;
-- administrator approval is still required to mark the order Delivered.
drop policy if exists "peh assigned writers upload drafts" on storage.objects;
create policy "peh assigned writers upload drafts"
on storage.objects for insert to authenticated with check(
  bucket_id='peh-order-files'
  and storage.filename(name) like 'DELIVERED-%'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}
);
-- Never allow a writer to update order payment or delivery status directly.
-- Never grant write access to customer order descriptions or contact details.

  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}
);

-- Writer-created files must be prefixed DELIVERED- for easier distinction;
-- administrator approval is still required to mark the order Delivered.
drop policy if exists "peh assigned writers upload drafts" on storage.objects;
create policy "peh assigned writers upload drafts"
on storage.objects for insert to authenticated with check(
  bucket_id='peh-order-files'
  and storage.filename(name) like 'DELIVERED-%'
  and exists(
    select 1 from public.orders o
    join public.peh_writer_accounts wa on wa.writer_id=o.assigned_writer_id
    where wa.user_id=(select auth.uid())
      and o.user_id::text=(storage.foldername(name))[1]
      and o.id::text=(storage.foldername(name))[2]
      and o.status not in ('cancelled')
  )
);
-- Never allow a writer to update order payment or delivery status directly.
-- Never grant write access to customer order descriptions or contact details.

  and public.peh_writer_can_access_file(
    ((storage.foldername(name))[1])::uuid,
    ((storage.foldername(name))[2])::uuid,false
  )
);

-- Writer-created files must be prefixed DELIVERED- for easier distinction;
-- administrator approval is still required to mark the order Delivered.
drop policy if exists "peh assigned writers upload drafts" on storage.objects;
create policy "peh assigned writers upload drafts"
on storage.objects for insert to authenticated with check(
  bucket_id='peh-order-files'
  and storage.filename(name) like 'DELIVERED-%'
  and exists(
    select 1 from public.orders o
    join public.peh_writer_accounts wa on wa.writer_id=o.assigned_writer_id
    where wa.user_id=(select auth.uid())
      and o.user_id::text=(storage.foldername(name))[1]
      and o.id::text=(storage.foldername(name))[2]
      and o.status not in ('cancelled')
  )
);
-- Never allow a writer to update order payment or delivery status directly.
-- Never grant write access to customer order descriptions or contact details.

  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}
);
-- Never allow a writer to update order payment or delivery status directly.
-- Never grant write access to customer order descriptions or contact details.

  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}
);

-- Writer-created files must be prefixed DELIVERED- for easier distinction;
-- administrator approval is still required to mark the order Delivered.
drop policy if exists "peh assigned writers upload drafts" on storage.objects;
create policy "peh assigned writers upload drafts"
on storage.objects for insert to authenticated with check(
  bucket_id='peh-order-files'
  and storage.filename(name) like 'DELIVERED-%'
  and exists(
    select 1 from public.orders o
    join public.peh_writer_accounts wa on wa.writer_id=o.assigned_writer_id
    where wa.user_id=(select auth.uid())
      and o.user_id::text=(storage.foldername(name))[1]
      and o.id::text=(storage.foldername(name))[2]
      and o.status not in ('cancelled')
  )
);
-- Never allow a writer to update order payment or delivery status directly.
-- Never grant write access to customer order descriptions or contact details.

  and public.peh_writer_can_access_file(
    ((storage.foldername(name))[1])::uuid,
    ((storage.foldername(name))[2])::uuid,false
  )
);

-- Writer-created files must be prefixed DELIVERED- for easier distinction;
-- administrator approval is still required to mark the order Delivered.
drop policy if exists "peh assigned writers upload drafts" on storage.objects;
create policy "peh assigned writers upload drafts"
on storage.objects for insert to authenticated with check(
  bucket_id='peh-order-files'
  and storage.filename(name) like 'DELIVERED-%'
  and exists(
    select 1 from public.orders o
    join public.peh_writer_accounts wa on wa.writer_id=o.assigned_writer_id
    where wa.user_id=(select auth.uid())
      and o.user_id::text=(storage.foldername(name))[1]
      and o.id::text=(storage.foldername(name))[2]
      and o.status not in ('cancelled')
  )
);
-- Never allow a writer to update order payment or delivery status directly.
-- Never grant write access to customer order descriptions or contact details.

  and public.peh_writer_can_access_file(
    ((storage.foldername(name))[1])::uuid,
    ((storage.foldername(name))[2])::uuid,true
  )
);
-- Never allow a writer to update order payment or delivery status directly.
-- Never grant write access to customer order descriptions or contact details.

  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}
);

-- Writer-created files must be prefixed DELIVERED- for easier distinction;
-- administrator approval is still required to mark the order Delivered.
drop policy if exists "peh assigned writers upload drafts" on storage.objects;
create policy "peh assigned writers upload drafts"
on storage.objects for insert to authenticated with check(
  bucket_id='peh-order-files'
  and storage.filename(name) like 'DELIVERED-%'
  and exists(
    select 1 from public.orders o
    join public.peh_writer_accounts wa on wa.writer_id=o.assigned_writer_id
    where wa.user_id=(select auth.uid())
      and o.user_id::text=(storage.foldername(name))[1]
      and o.id::text=(storage.foldername(name))[2]
      and o.status not in ('cancelled')
  )
);
-- Never allow a writer to update order payment or delivery status directly.
-- Never grant write access to customer order descriptions or contact details.

  and public.peh_writer_can_access_file(
    ((storage.foldername(name))[1])::uuid,
    ((storage.foldername(name))[2])::uuid,false
  )
);

-- Writer-created files must be prefixed DELIVERED- for easier distinction;
-- administrator approval is still required to mark the order Delivered.
drop policy if exists "peh assigned writers upload drafts" on storage.objects;
create policy "peh assigned writers upload drafts"
on storage.objects for insert to authenticated with check(
  bucket_id='peh-order-files'
  and storage.filename(name) like 'DELIVERED-%'
  and exists(
    select 1 from public.orders o
    join public.peh_writer_accounts wa on wa.writer_id=o.assigned_writer_id
    where wa.user_id=(select auth.uid())
      and o.user_id::text=(storage.foldername(name))[1]
      and o.id::text=(storage.foldername(name))[2]
      and o.status not in ('cancelled')
  )
);
-- Never allow a writer to update order payment or delivery status directly.
-- Never grant write access to customer order descriptions or contact details.
