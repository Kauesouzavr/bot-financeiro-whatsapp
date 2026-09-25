create table if not exists public.monthly_usage (
  month text primary key check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  replies_sent integer not null default 0 check (replies_sent >= 0)
);

alter table public.monthly_usage enable row level security;
