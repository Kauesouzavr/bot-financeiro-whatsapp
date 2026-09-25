create table if not exists public.pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null check (kind in ('confirm_image')),
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists pending_actions_user_id_idx
  on public.pending_actions (user_id);

alter table public.pending_actions enable row level security;
