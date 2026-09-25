# Bot Financeiro no WhatsApp

Bot de finanças pessoais: manda "gastei 45 no ifood" (texto, áudio ou foto de comprovante PIX) pro WhatsApp, o bot registra, categoriza e responde com o saldo do mês.

Projeto pessoal com dois objetivos: uso real no dia a dia e portfólio para vaga de dev full stack. Feito com custo zero (planos gratuitos de Vercel, Supabase, Groq, Gemini e o número de teste da Meta).

## Stack

| Parte                 | Escolha                                               |
| --------------------- | ----------------------------------------------------- |
| App + API             | Next.js (App Router) + TypeScript `strict`, na Vercel |
| Banco                 | Supabase (Postgres)                                   |
| WhatsApp              | WhatsApp Cloud API (Meta)                             |
| Áudio → texto         | Groq (Whisper)                                        |
| IA de reserva (texto) | Groq (LLM, saída em JSON)                             |
| Foto de comprovante   | Gemini (`@google/genai`)                              |
| Validação             | zod                                                   |
| Testes e CI           | Vitest + GitHub Actions                               |

## Arquitetura

O núcleo (`src/core`) não sabe de onde a mensagem veio — é regra de negócio pura, sem I/O, 100% testável. Os canais (`src/channels`) só traduzem entrada e saída: hoje existe o canal WhatsApp e, a partir da Fase 2, um simulador web local.

```
src/
  core/                 # regras de negócio puras, sem I/O, 100% testável
    parser/             # texto → transações
    categories/         # dicionário padrão + aprendizado por usuário
    balance/            # saldo do mês
    replies/            # formatação das respostas
  services/             # supabase, groq, gemini (I/O)
  channels/
    whatsapp/           # assinatura, leitura do webhook, envio, download de mídia
    simulator/          # chat web local que usa o mesmo núcleo
app/
  api/webhook/whatsapp/route.ts
  simulador/page.tsx
supabase/migrations/    # SQL versionado
tests/
```

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preenche com os valores reais (nunca commitar)
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

### Scripts

| Comando              | O que faz                         |
| -------------------- | --------------------------------- |
| `npm run dev`        | servidor de desenvolvimento       |
| `npm run build`      | build de produção                 |
| `npm run lint`       | ESLint                            |
| `npm run typecheck`  | checa os tipos TypeScript (`tsc`) |
| `npm test`           | roda os testes (Vitest)           |
| `npm run test:watch` | testes em modo watch              |
| `npm run format`     | formata tudo com Prettier         |

## Banco de dados (Supabase)

As migrations ficam em `supabase/migrations/`, numeradas na ordem em que devem ser executadas. Por enquanto, rodar cada arquivo, na ordem, colando o SQL no **SQL Editor** do painel do Supabase:

1. `0001_create_users.sql`
2. `0002_create_transactions.sql`
3. `0003_create_learned_categories.sql`
4. `0004_create_pending_actions.sql`
5. `0005_create_processed_messages.sql`
6. `0006_create_monthly_usage.sql`

Todas as tabelas têm **Row Level Security (RLS)** ligado e nenhuma policy: só o backend, usando a chave secreta (`SUPABASE_SECRET_KEY`, que ignora RLS), acessa os dados. Isso é propositalmente redundante — mesmo que a chave pública vaze ou seja usada por engano em algum lugar, ninguém lê ou escreve nas tabelas.

## Variáveis de ambiente

Ver `.env.example` para a lista completa. Nenhum segredo vai pro Git — `.env.local` está no `.gitignore`.

## Estado atual

**Fase 1 (Fundação) concluída:** projeto Next.js + TS strict, ESLint + Prettier, Vitest, estrutura de pastas do núcleo, cliente Supabase server-only, migrations com RLS, CI no GitHub Actions (lint, typecheck, testes — sem depender de nenhuma chave) e este README.

Próxima fase: núcleo (parser, categorias, saldo, respostas) + simulador web local.
