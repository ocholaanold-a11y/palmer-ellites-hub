-- Palmer Ellites Hub: enforce cross-account isolation even if old permissive
-- storage/order policies remain. Run as postgres. Can be safely run again.
-- Important: administrators can still access orders for their operational role.
-- A writer can access source files only for orders actively assigned to them.

-- Use an authorization function that does not expose order rows or customer
-- contact details to callers. Relies on the writer portal migration.
create or replace function public.peh_private_file_permission(
  p_bucket text, p_path text
)
returns boolean
language plpgsql security definer stable set search_path = ''
as $$
declare
  folder text[];
  owner_id uuid;
  order_id uuid;
begin
  if (select auth.uid()) is null then return false; end if;
  folder := string_to_array(p_path,'/');
  if array_length(folder,1) < 3
     or folder[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or folder[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then return false; end if;
  owner_id := folder[1]::uuid;
  order_id := folder[2]::uuid;
  if not exists (
    select 1 from public.orders o
    where o.id=order_id and o.user_id=owner_id
  ) then return false; end if;

  if exists (
    select 1 from public.peh_admins a
    where a.user_id=(select auth.uid())
  ) then return true; end if;

  if p_bucket='peh-order-files' and owner_id=(select auth.uid())
  then return true; end if;

  if p_bucket in ('peh-order-files','peh-writer-drafts') then
    return public.peh_writer_can_access_file(owner_id,order_id,false);
  end if;
  return false;
end;
$$;
revoke all on function public.peh_private_file_permission(text,text) from public;
grant execute on function public.peh_private_file_permission(text,text) to authenticated;

-- Restrictive policies are ANDed with any existing permissive policies.
-- This prevents an accidentally broad additional policy from exposing orders.
alter table public.orders enable row level security;
drop policy if exists "peh enforce order account isolation" on public.orders;
create policy "peh enforce order account isolation" on public.orders
  as restrictive for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.peh_admins a
      where a.user_id=(select auth.uid())
    )
  );

-- Restrict all reads from both private PEH storage buckets.
-- Policies for other unrelated storage buckets are not affected.
update storage.buckets set public=false
where id in ('peh-order-files','peh-writer-drafts');

drop policy if exists "peh enforce private file isolation" on storage.objects;
create policy "peh enforce private file isolation" on storage.objects
  as restrictive for select to authenticated
  using (
    bucket_id not in ('peh-order-files','peh-writer-drafts')
    or public.peh_private_file_permission(bucket_id,name)
  );

-- Check existing policies for unusually permissive rules after activation:
-- select schemaname,tablename,policyname,permissive,roles,cmd,qual
-- from pg_policies
-- where (schemaname='public' and tablename in ('orders','peh_revisions','peh_notifications'))
--    or (schemaname='storage' and tablename='objects')
-- order by schemaname,tablename,policyname;
--
-- Note: restriction of *write* policies is a separate security review.
-- Never create a public bucket or share privileged Supabase keys in JS.
