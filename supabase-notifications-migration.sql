-- Palmer Ellites Hub: customer dashboard notifications for completed deliveries.
-- Run as postgres in Supabase SQL Editor. Safe to rerun.

create table if not exists public.peh_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null check (event_type in ('delivered')),
  title text not null,
  message text not null,
  read_at timestamptz,
  email_status text not null default 'pending'
    check (email_status in ('pending','sending','sent','failed')),
  email_error text,
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists peh_notifications_recipient_idx
  on public.peh_notifications(user_id,created_at desc);
alter table public.peh_notifications enable row level security;
revoke all on public.peh_notifications from anon;
grant select on public.peh_notifications to authenticated;
grant update (read_at) on public.peh_notifications to authenticated;

drop policy if exists "client reads own notifications" on public.peh_notifications;
create policy "client reads own notifications"
on public.peh_notifications for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "client marks own notifications read" on public.peh_notifications;
create policy "client marks own notifications read"
on public.peh_notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
-- No browser INSERT or DELETE; email_status can only be changed with privileged server credentials.

create or replace function public.peh_notify_when_delivered()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'delivered'
     and old.status is distinct from new.status then
    insert into public.peh_notifications
      (user_id,order_id,event_type,title,message)
    values (
      new.user_id,new.id,'delivered',
      'Your PEH task is ready',
      'Your completed documents are ready. Open My Private Files to download them.'
    );
  end if;
  return new;
end;
$$;
revoke all on function public.peh_notify_when_delivered() from public;
drop trigger if exists peh_order_delivered_notification on public.orders;
create trigger peh_order_delivered_notification
after update of status on public.orders
for each row execute function public.peh_notify_when_delivered();

-- The dashboard notification works after this script is run.
-- Email notifications additionally need the peh-delivery-email Edge Function
-- and a Database Webhook configured for INSERT on peh_notifications.
-- Never put service-role or email-provider secrets in public website code.
