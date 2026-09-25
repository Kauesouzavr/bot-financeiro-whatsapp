create table if not exists public.processed_messages (
  wa_message_id text primary key,
  received_at timestamptz not null default now()
);

alter table public.processed_messages enable row level security;
