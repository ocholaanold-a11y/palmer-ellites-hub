-- PEH initial order table; run in a Supabase project owned by PEH.
-- Never enable anonymous order reads/writes.
create extension if not exists pgcrypto;
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 service text not null check (char_length(service) between 2 and 120),
 description text not null check (char_length(description) between 20 and 3000),
 deadline timestamptz not null,
 contact_email text not null,
 preferred_writer text,
 requested_currency text not null default 'USD' check (requested_currency ~ '^[A-Z]{3}
 status text not null default 'submitted' check (status in ('submitted','quoted','awaiting_payment','paid','assigned','in_progress','review','delivered','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists orders_user_created_idx on public.orders(user_id,created_at desc);
alter table public.orders enable row level security;
-- Clients can read their own orders.
create policy "client can read own orders" on public.orders for select to authenticated using (auth.uid() = user_id);
-- Clients may submit a request, but cannot self-mark an order paid or delivered.
create policy "client submit initial request" on public.orders for insert to authenticated with check (auth.uid() = user_id and status = 'submitted');
-- No client update/delete policy. Admin operations should use a dedicated secure backend with enforced roles.
),
 status text not null default 'submitted' check (status in ('submitted','quoted','awaiting_payment','paid','assigned','in_progress','review','delivered','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists orders_user_created_idx on public.orders(user_id,created_at desc);
alter table public.orders enable row level security;
-- Clients can read their own orders.
create policy "client can read own orders" on public.orders for select to authenticated using (auth.uid() = user_id);
-- Clients may submit a request, but cannot self-mark an order paid or delivered.
create policy "client submit initial request" on public.orders for insert to authenticated with check (auth.uid() = user_id and status = 'submitted');
-- No client update/delete policy. Admin operations should use a dedicated secure backend with enforced roles.
