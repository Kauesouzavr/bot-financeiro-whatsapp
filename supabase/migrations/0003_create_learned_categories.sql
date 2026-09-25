create table if not exists public.learned_categories (
  user_id uuid not null references public.users (id) on delete cascade,
  term text not null,
  category text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, term)
);

alter table public.learned_categories enable row level security;
