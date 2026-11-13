-- Palmer Ellites Hub (PEH) - Phase 9: private order-specific messaging.
-- Run as the postgres role in Supabase SQL Editor.
-- Requires orders, peh_admins, peh_writer_accounts, and assigned_writer_id.
-- Every participant sees ONLY messages for an order they own/administer/
-- are currently assigned to. No student-to-student access.
-- Phase 9 also restricts off-platform contact requests, adds abuse reports,
-- and enables administrators to suspend a writer's access.

alter table public.peh_writer_accounts
  add column if not exists suspended boolean not null default false;

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
        and wa.suspended=false
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

-- Keep suspended writers out of the existing project and file workflows too.
create or replace function public.peh_writer_can_access_file(
  p_owner uuid,p_order uuid,p_upload boolean default false
)
returns boolean language sql security definer stable set search_path=''
as $peh$
  select exists(
    select 1 from public.orders o
    join public.peh_writer_accounts wa on wa.writer_id=o.assigned_writer_id
    where wa.user_id=(select auth.uid()) and wa.suspended=false
      and o.id=p_order and o.user_id=p_owner
      and (not p_upload or o.status <> 'cancelled')
  );
$peh$;
revoke all on function public.peh_writer_can_access_file(uuid,uuid,boolean) from public;
grant execute on function public.peh_writer_can_access_file(uuid,uuid,boolean) to authenticated;

create or replace function public.peh_get_my_writer_projects()
returns table (
  id uuid,user_id uuid,service text,description text,
  deadline timestamptz,status text,created_at timestamptz
)
language sql security definer stable set search_path=''
as $peh$
  select o.id,o.user_id,o.service,o.description,o.deadline,o.status,o.created_at
  from public.orders o
  join public.peh_writer_accounts wa on wa.writer_id=o.assigned_writer_id
  where wa.user_id=(select auth.uid()) and wa.suspended=false
  order by o.created_at desc limit 50;
$peh$;
revoke all on function public.peh_get_my_writer_projects() from public;
grant execute on function public.peh_get_my_writer_projects() to authenticated;

-- Reported misconduct is stored separately from ordinary messages.
create table if not exists public.peh_message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.peh_order_messages(id),
  order_id uuid not null references public.orders(id),
  reporter_id uuid not null default auth.uid() references auth.users(id),
  reason text not null check(reason in
    ('personal_information','off_platform_contact','payment_request','threat_or_extortion','harassment','other')),
  details text not null default '' check(char_length(details)<=1000),
  status text not null default 'open' check(status in ('open','reviewing','resolved')),
  admin_note text not null default '' check(char_length(admin_note)<=2000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique(message_id,reporter_id)
);
create index if not exists peh_message_reports_status_created_idx
  on public.peh_message_reports(status,created_at desc);
alter table public.peh_message_reports enable row level security;
revoke all on public.peh_message_reports from anon;
revoke all on public.peh_message_reports from authenticated;
grant select,insert on public.peh_message_reports to authenticated;
grant update(status,admin_note,reviewed_at) on public.peh_message_reports to authenticated;

drop policy if exists "peh read message reports" on public.peh_message_reports;
create policy "peh read message reports" on public.peh_message_reports
for select to authenticated using (
  reporter_id=(select auth.uid())
  or exists(select 1 from public.peh_admins a where a.user_id=(select auth.uid()))
);
drop policy if exists "peh submit message reports" on public.peh_message_reports;
create policy "peh submit message reports" on public.peh_message_reports
for insert to authenticated with check (
  reporter_id=(select auth.uid())
  and status='open'
  and admin_note=''
  and reviewed_at is null
  and exists(
    select 1 from public.peh_order_messages m
    where m.id=message_id and m.order_id=peh_message_reports.order_id
      and m.sender_id <> (select auth.uid())
      and public.peh_message_role(m.order_id) is not null
  )
);
drop policy if exists "peh admins review reports" on public.peh_message_reports;
create policy "peh admins review reports" on public.peh_message_reports
for update to authenticated
using (exists(select 1 from public.peh_admins a where a.user_id=(select auth.uid())))
with check (exists(select 1 from public.peh_admins a where a.user_id=(select auth.uid())));

-- Admins alone can suspend/reactivate linked writer accounts. Existing
-- peh_admins update policy on peh_writer_accounts already checks membership.
grant update(suspended) on public.peh_writer_accounts to authenticated;

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

  -- All direct contact details, non-PEH links and off-platform messaging are
  -- blocked at the database layer (not merely hidden in JavaScript).
  if new.body ~* '[[:alnum:]_.%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}'
     or new.body ~* '(^|[^[:alnum:]])(\+?[0-9][0-9 .()-]{7,}[0-9])([^[:alnum:]]|$)'
     or new.body ~* '(https?://|www\.|t\.me/|wa\.me/|discord\.gg/)'
     or new.body ~* '\m(whatsapp|telegram|signal|snapchat|instagram|facebook|discord|skype)\M'
     or new.body ~* '\m(mpesa|m-pesa|paypal|cashapp|venmo|western union|crypto|bitcoin)\M'
  then
    raise exception 'For safety, do not share contact details, external links or off-platform payment/messaging information. Use PEH messages and official payment channels.'
      using errcode='23514';
  end if;

  if caller_role='writer' and (
       new.body ~* '\m(phone number|email address|home address|postal address|physical address|id number|passport|national id|bank details|bank account|credit card|debit card|password|verification code|otp)\M'
       or new.body ~* '\m(pay me|send me money|transfer money|outside (the )?(platform|website)|contact me (directly|privately)|private payment|personal number)\M'
       or new.body ~* '\m(blackmail|expose you|report you unless|threaten|leak your|release your)\M'
  ) then
    raise exception 'This request is prohibited by PEH safeguarding rules. Writers must not request personal information, private payments or threaten clients.'
      using errcode='23514';
  end if;

  -- Basic server-side anti-spam limit. More advanced moderation and abuse
  -- response is required before public launch.
  if (
    select count(*) from public.peh_order_messages m
    where m.sender_id=(select auth.uid())
      and m.order_id=new.order_id
      and m.created_at > now()-interval '60 seconds'
  ) >= 5 then
    raise exception 'Message limit reached. Please wait a minute before sending again.'
      using errcode='23514';
  end if;
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
