<div align="center">

<img src=".github/assets/banner.svg" alt="Bot Financeiro no WhatsApp" width="100%"/>

<img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js"/> <img src="https://img.shields.io/badge/TypeScript_strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript strict"/> <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase"/> <img src="https://img.shields.io/badge/WhatsApp_Cloud_API-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WhatsApp Cloud API"/> <img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest"/>

<a href="https://github.com/Kauesouzavr/bot-financeiro-whatsapp/actions/workflows/ci.yml"><img src="https://github.com/Kauesouzavr/bot-financeiro-whatsapp/actions/workflows/ci.yml/badge.svg" alt="CI"/></a> <a href="https://github.com/Kauesouzavr/bot-financeiro-whatsapp/actions/workflows/codeql.yml"><img src="https://github.com/Kauesouzavr/bot-financeiro-whatsapp/actions/workflows/codeql.yml/badge.svg" alt="CodeQL"/></a> <a href="https://github.com/Kauesouzavr/bot-financeiro-whatsapp/actions/workflows/secret-scan.yml"><img src="https://github.com/Kauesouzavr/bot-financeiro-whatsapp/actions/workflows/secret-scan.yml/badge.svg" alt="Secret scan"/></a>

<a href="#arquitetura"><b>Arquitetura</b></a> · <a href="#o-núcleo-srccore"><b>O núcleo</b></a> · <a href="#whatsapp-srcchannelswhatsapp--appapiwebhookwhatsapp"><b>WhatsApp</b></a> · <a href="SECURITY.md"><b>Segurança</b></a>

</div>

> 🇺🇸 **In English:** a personal-finance bot: send "gastei 45 no ifood" on WhatsApp and it records, categorizes and replies with the monthly balance. Clean architecture (pure, fully tested core with no I/O; channels only translate input/output), HMAC-verified webhook, idempotent processing and a free-tier quota guard. Next.js + strict TypeScript + Supabase, zero cost.

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
| `npm run typecheck`  | gera os tipos das rotas (`next typegen`) e checa tudo com `tsc` |
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
- **`handle-message.ts`** — o ponto de entrada: liga parser → categoria → grava no Supabase → recalcula saldo → formata resposta. É o mesmo código que o simulador e o WhatsApp chamam.
- **`quota`** — decide se manda a resposta ou entra em modo silencioso, e se deve avisar que está perto do limite mensal.

## Simulador

`/simulador` é um chat local que conversa com o núcleo de verdade (grava no Supabase de verdade), usando um usuário de teste fixo — não o seu número real de WhatsApp.

## WhatsApp (`src/channels/whatsapp` + `app/api/webhook/whatsapp`)

- **`verify-signature`** — valida o `X-Hub-Signature-256` (HMAC SHA-256 com o App Secret) sobre o corpo cru da requisição.
- **`phone`** — o `wa_id` pode chegar com ou sem o nono dígito; gera as duas formas pra comparar com a tabela `users`, e mascara o telefone pra log seguro.
- **`parse-webhook`** — extrai as mensagens do payload da Meta (ignora eventos de status como "entregue"/"lido") e traduz pro formato normalizado do núcleo.
- **`send-message`** — envia texto pela Graph API. Não existe função de template (proibido: geraria cobrança e o bot só responde dentro da janela de 24h de uma mensagem recebida).
- **`route.ts`** — `GET` faz o handshake de verificação do webhook; `POST` valida a assinatura, responde `200` na hora e processa a mensagem depois com `after()` (idempotência por `wa_message_id` → número autorizado e ativo → núcleo → cota → envia).

## Deploy (Vercel) e configuração na Meta

1. Conectar o repositório na Vercel (plano Hobby) e configurar lá as mesmas variáveis do `.env.local` (nunca copiar o `.env.local` em si, só os valores).
2. No painel da Meta, em **WhatsApp → Configuração da API → Webhook**:
   - Callback URL: `https://<seu-projeto>.vercel.app/api/webhook/whatsapp`
   - Verify token: o mesmo valor de `WHATSAPP_VERIFY_TOKEN`
   - Assinar o campo **`messages`**

## Estado atual

**Fases 1 a 3 concluídas:** fundação, núcleo (parser/categorias/saldo/respostas), simulador e a integração com o WhatsApp (webhook, assinatura, números autorizados, idempotência, cota e modo silencioso). Testes automatizados cobrem todos os exemplos de mensagem do escopo do projeto, a verificação de assinatura e a lógica de cota.

Próxima fase: IA de reserva (Groq) para mensagens fora do padrão, e correções (`muda pra X`, `apaga o último`).

---

Feito por **Kauê Souza** · [LinkedIn](https://www.linkedin.com/in/kauesouzaproti/) · [GitHub](https://github.com/Kauesouzavr)
