-- PEH: log blocked messaging attempts without changing message-blocking rules.
-- Run as postgres in Supabase SQL Editor. Additive and safe to rerun.

create table if not exists public.peh_blocked_message_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  actor_role text not null check (actor_role in ('client','writer')),
  category text not null check (category in (
    'contact_details','external_link','off_platform_messaging',
    'off_platform_payment','personal_information_request',
    'threat_or_extortion','other_safeguarding'
  )),
  status text not null default 'open' check (status in ('open','reviewing','resolved')),
  created_at timestamptz not null default now(),
  admin_note text not null default '' check (char_length(admin_note) <= 2000)
);

create index if not exists peh_blocked_attempts_created_idx
  on public.peh_blocked_message_attempts(status, created_at desc);
create index if not exists peh_blocked_attempts_actor_idx
  on public.peh_blocked_message_attempts(actor_id, created_at desc);

alter table public.peh_blocked_message_attempts enable row level security;
revoke all on public.peh_blocked_message_attempts from anon, authenticated;
grant select, update(status, admin_note) on public.peh_blocked_message_attempts to authenticated;

drop policy if exists "peh admins read blocked attempts" on public.peh_blocked_message_attempts;
create policy "peh admins read blocked attempts"
on public.peh_blocked_message_attempts for select to authenticated
using (exists (
  select 1 from public.peh_admins a where a.user_id = (select auth.uid())
));

drop policy if exists "peh admins review blocked attempts" on public.peh_blocked_message_attempts;
create policy "peh admins review blocked attempts"
on public.peh_blocked_message_attempts for update to authenticated
using (exists (
  select 1 from public.peh_admins a where a.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.peh_admins a where a.user_id = (select auth.uid())
));

create or replace function public.peh_log_blocked_message_attempt(
  p_order_id uuid,
  p_category text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role text;
  v_id uuid;
  v_recent integer;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_role := public.peh_message_role(p_order_id);
  if v_role not in ('client','writer') then
    raise exception 'Only an assigned client or writer can log a blocked attempt'
      using errcode = '42501';
  end if;

  if p_category not in (
    'contact_details','external_link','off_platform_messaging',
    'off_platform_payment','personal_information_request',
    'threat_or_extortion','other_safeguarding'
  ) then
    raise exception 'Invalid safeguarding category' using errcode = '22023';
  end if;

  select count(*) into v_recent
  from public.peh_blocked_message_attempts b
  where b.actor_id = v_actor
    and b.created_at > now() - interval '1 hour';

  if v_recent >= 20 then
    raise exception 'Blocked-attempt logging rate limit reached'
      using errcode = '23514';
  end if;

  insert into public.peh_blocked_message_attempts(order_id, actor_id, actor_role, category)
  values (p_order_id, v_actor, v_role, p_category)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.peh_log_blocked_message_attempt(uuid,text) from public, anon;
grant execute on function public.peh_log_blocked_message_attempt(uuid,text) to authenticated;
