-- Liga a conta de login do app (Supabase Auth) ao usuário do bot.
-- O usuário continua sendo identificado pelo telefone no WhatsApp; no app, pelo login.
-- Assim a mesma pessoa vê os mesmos dados nos dois canais.
--
-- Depois de criar o login no painel do Supabase (Authentication > Users), ligue-o assim
-- (troque os valores; nunca commite dado real neste arquivo):
--   update public.users set auth_user_id = '<id do login>' where phone = '<telefone só com dígitos>';
-- Quem ainda não tem linha em users (ex.: só vai usar o app) precisa de uma, com telefone:
--   insert into public.users (phone, name, auth_user_id) values ('<telefone>', '<nome>', '<id do login>');
alter table public.users
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;
