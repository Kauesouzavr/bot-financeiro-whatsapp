-- Orçamento mensal por categoria de gasto: um limite por usuário e categoria, valendo todo mês.
-- A categoria é validada no código (só categorias de saída); aqui o banco garante o que é
-- inegociável: um limite por categoria, sempre positivo, e que só existe para um usuário real.
create table if not exists public.budgets (
  user_id uuid not null references public.users (id) on delete cascade,
  category text not null,
  limit_cents integer not null check (limit_cents > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.budgets enable row level security;
-- Sem policies: só o backend (chave secreta, que ignora RLS) acessa esta tabela.
-- RLS ligado aqui é defesa em profundidade, caso a chave pública seja usada por engano.
