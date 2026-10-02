-- Ordem de inserção confiável. "gastei 45 no ifood e 12 no uber" grava duas linhas numa
-- inserção só, e as duas ficam com o mesmo created_at: sem desempate, "a última transação"
-- (alvo de "muda pra X" e "apaga o último") seria ambígua.
-- Num identity, o Postgres numera as linhas existentes ao adicionar a coluna.
alter table public.transactions
  add column if not exists seq bigint generated always as identity;

create index if not exists transactions_user_id_seq_idx
  on public.transactions (user_id, seq desc);
