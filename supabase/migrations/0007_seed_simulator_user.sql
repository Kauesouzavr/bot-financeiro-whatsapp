-- Usuário fixo só para o /simulador local, separado do número real do WhatsApp.
insert into public.users (id, phone, name, active)
values ('00000000-0000-0000-0000-000000000001', '00000000000', 'Simulador', true)
on conflict (id) do nothing;
