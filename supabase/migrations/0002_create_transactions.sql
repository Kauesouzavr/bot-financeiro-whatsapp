create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount_cents integer not null check (amount_cents > 0),
  description text,
  category text not null,
  occurred_on date not null,
  source text not null check (source in ('text', 'audio', 'image', 'simulator')),
  created_at timestamptz not null default now()
);

-- Acelera o cálculo do saldo do mês, que sempre filtra por usuário + intervalo de datas.
create index if not exists transactions_user_id_occurred_on_idx
  on public.transactions (user_id, occurred_on);

alter table public.transactions enable row level security;
