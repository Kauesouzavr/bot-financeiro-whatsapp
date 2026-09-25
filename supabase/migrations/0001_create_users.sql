create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^[0-9]{8,15}$'),
  name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
-- Sem policies: só o backend (chave secreta, que ignora RLS) acessa esta tabela.
-- RLS ligado aqui é defesa em profundidade, caso a chave pública seja usada por engano.
