-- Histórico do chat do app: o que a pessoa escreveu e o que o bot respondeu.
-- O app guarda só as últimas 100 mensagens por pessoa (o resto é apagado ao enviar) e a pessoa
-- pode limpar tudo. Não guardar nada sensível aqui: o texto vai exatamente como foi digitado.
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('user', 'bot')),
  text text not null,
  created_at timestamptz not null default now(),
  -- O usuário e a resposta do bot entram na mesma inserção e ficam com o mesmo created_at.
  -- O seq (numeração automática) desempata e garante a ordem certa da conversa.
  seq bigint generated always as identity
);

create index if not exists chat_messages_user_id_seq_idx
  on public.chat_messages (user_id, seq desc);

alter table public.chat_messages enable row level security;
-- Sem policies: só o backend (chave secreta, que ignora RLS) acessa esta tabela.
