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
7. `0007_seed_simulator_user.sql` — cria o usuário fixo usado pelo `/simulador`

Todas as tabelas têm **Row Level Security (RLS)** ligado e nenhuma policy: só o backend, usando a chave secreta (`SUPABASE_SECRET_KEY`, que ignora RLS), acessa os dados. Isso é propositalmente redundante — mesmo que a chave pública vaze ou seja usada por engano em algum lugar, ninguém lê ou escreve nas tabelas.

## Variáveis de ambiente

Ver `.env.example` para a lista completa. Nenhum segredo vai pro Git — `.env.local` está no `.gitignore`.

## O núcleo (`src/core`)

Regra de negócio pura, sem I/O, 100% testável:

- **`parser`** — reconhece frases como "gastei 45 no ifood" ou "recebi 1500 salário" por regras (sem IA ainda) e devolve uma ou mais transações estruturadas, sempre em centavos.
- **`categories`** — dicionário de palavra-chave → categoria (ex.: "ifood" → Delivery).
- **`date/sao-paulo`** — resolve "hoje", "ontem" e "dia N" no fuso de São Paulo, usando só `Intl` (sem biblioteca de datas).
- **`balance`** — soma entradas/saídas de um conjunto de transações e calcula o saldo.
- **`replies`** — formata as mensagens de resposta.
- **`handle-message.ts`** — o ponto de entrada: liga parser → categoria → grava no Supabase → recalcula saldo → formata resposta. É o mesmo código que o simulador e (na Fase 3) o WhatsApp vão chamar.

## Simulador

`/simulador` é um chat local que conversa com o núcleo de verdade (grava no Supabase de verdade), usando um usuário de teste fixo — não o seu número real de WhatsApp.

## Estado atual

**Fase 1 (Fundação)** e **Fase 2 (Núcleo + simulador)** concluídas: parser, categorias, saldo, respostas e o `/simulador` funcionando de ponta a ponta. Testes automatizados cobrem todos os exemplos de mensagem do escopo do projeto.

Próxima fase: integração com o WhatsApp (webhook, assinatura, cota, modo silencioso).
