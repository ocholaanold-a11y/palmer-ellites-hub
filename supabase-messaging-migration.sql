-- Palmer Ellites Hub (PEH) - Phase 9: private order-specific messaging.
-- Run as the postgres role in Supabase SQL Editor.
-- Requires orders, peh_admins, peh_writer_accounts, and assigned_writer_id.
-- Every participant sees ONLY messages for an order they own/administer/
-- are currently assigned to. No student-to-student access.

create or replace function public.peh_message_role(p_order uuid)
returns text language sql stable security definer set search_path=''
as $$
  select case
    when (select auth.uid()) is null then null
    when exists (
      select 1 from public.peh_admins a where a.user_id=(select auth.uid())
    ) and exists (
      select 1 from public.orders o where o.id=p_order
    ) then 'admin'
    when exists (
      select 1 from public.orders o
      join public.peh_writer_accounts wa on wa.writer_id=o.assigned_writer_id
      where o.id=p_order and wa.user_id=(select auth.uid())
    ) then 'writer'
    when exists (
      select 1 from public.orders o
      where o.id=p_order and o.user_id=(select auth.uid())
    ) then 'client'
    else null
  end;
$$;
revoke all on function public.peh_message_role(uuid) from public;
grant execute on function public.peh_message_role(uuid) to authenticated;

create table if not exists public.peh_order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users(id),
  sender_role text not null check(sender_role in ('client','writer','admin')),
  body text not null check(char_length(btrim(body)) between 1 and 3000),
  created_at timestamptz not null default now()
);

create index if not exists peh_order_messages_order_time_idx
  on public.peh_order_messages(order_id,created_at desc,id desc);
alter table public.peh_order_messages enable row level security;

revoke all on public.peh_order_messages from anon;
revoke update,delete on public.peh_order_messages from authenticated;
grant select,insert on public.peh_order_messages to authenticated;

drop policy if exists "peh messages read by order participants" on public.peh_order_messages;
create policy "peh messages read by order participants"
on public.peh_order_messages for select to authenticated
using (public.peh_message_role(order_id) is not null);

drop policy if exists "peh messages send by order participants" on public.peh_order_messages;
create policy "peh messages send by order participants"
on public.peh_order_messages for insert to authenticated
with check (
  sender_id=(select auth.uid())
  and sender_role=public.peh_message_role(order_id)
  and char_length(btrim(body)) between 1 and 3000
);

-- The database sets sender identity and role. Do not trust role or sender UUID
-- received from a browser, even if the UI only shows authorized options.
create or replace function public.peh_set_message_sender()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  caller_role text;
begin
  caller_role := public.peh_message_role(new.order_id);
  if caller_role is null or (select auth.uid()) is null then
    raise exception 'This account is not authorized for the selected order'
      using errcode='42501';
  end if;
  new.sender_id := (select auth.uid());
  new.sender_role := caller_role;
  new.body := btrim(new.body);
  new.created_at := now();
  return new;
end;
$$;
revoke all on function public.peh_set_message_sender() from public;
drop trigger if exists peh_message_sender_guard on public.peh_order_messages;
create trigger peh_message_sender_guard
  before insert on public.peh_order_messages for each row
  execute function public.peh_set_message_sender();

-- The table has no UPDATE or DELETE RLS policy, and neither privilege is
-- granted to authenticated users. Messages are immutable via the client API.
-- Real-time service is optional; Phase 9 initially uses manual refresh and
-- 30-second polling only while a messaging panel is open.
