<div align="center">

<img src=".github/assets/banner.svg" alt="Bot Financeiro no WhatsApp" width="100%"/>

<img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js"/> <img src="https://img.shields.io/badge/TypeScript_strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript strict"/> <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase"/> <img src="https://img.shields.io/badge/WhatsApp_Cloud_API-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WhatsApp Cloud API"/> <img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest"/>

<a href="https://github.com/Kauesouzavr/bot-financeiro-whatsapp/actions/workflows/ci.yml"><img src="https://github.com/Kauesouzavr/bot-financeiro-whatsapp/actions/workflows/ci.yml/badge.svg" alt="CI"/></a> <a href="https://github.com/Kauesouzavr/bot-financeiro-whatsapp/actions/workflows/codeql.yml"><img src="https://github.com/Kauesouzavr/bot-financeiro-whatsapp/actions/workflows/codeql.yml/badge.svg" alt="CodeQL"/></a> <a href="https://github.com/Kauesouzavr/bot-financeiro-whatsapp/actions/workflows/secret-scan.yml"><img src="https://github.com/Kauesouzavr/bot-financeiro-whatsapp/actions/workflows/secret-scan.yml/badge.svg" alt="Secret scan"/></a>

<a href="#arquitetura"><b>Arquitetura</b></a> &nbsp;&nbsp;&nbsp; <a href="#o-núcleo-srccore"><b>O núcleo</b></a> &nbsp;&nbsp;&nbsp; <a href="#whatsapp-srcchannelswhatsapp--appapiwebhookwhatsapp"><b>WhatsApp</b></a> &nbsp;&nbsp;&nbsp; <a href="SECURITY.md"><b>Segurança</b></a>

</div>

> **In English:** a personal-finance bot: send "gastei 45 no ifood" on WhatsApp and it records, categorizes and replies with the monthly balance. Clean architecture (pure, fully tested core with no I/O; channels only translate input/output), HMAC-verified webhook, idempotent processing and a free-tier quota guard. Next.js + strict TypeScript + Supabase, zero cost.

Bot de finanças pessoais: manda "gastei 45 no ifood" (texto, áudio ou foto de comprovante PIX) pro WhatsApp, o bot registra, categoriza e responde com o saldo do mês.

Projeto pessoal com dois objetivos: uso real no dia a dia e portfólio para vaga de dev full stack. Feito com custo zero (planos gratuitos de Vercel, Supabase, Groq, Gemini e o número de teste da Meta).

## Stack

| Parte                 | Escolha                                               |
| --------------------- | ----------------------------------------------------- |
| App + API             | Next.js (App Router) + TypeScript `strict`, na Vercel |
| Banco                 | Supabase (Postgres)                                   |
| WhatsApp              | WhatsApp Cloud API (Meta)                             |
| Áudio → texto         | Groq (Whisper)                                        |
| IA de reserva (texto) | Groq (LLM, saída em JSON); Gemini se o Groq falhar    |
| Foto de comprovante   | Gemini (`@google/genai`)                              |
| Validação             | zod                                                   |
| Testes e CI           | Vitest + GitHub Actions                               |

## Arquitetura

O núcleo (`src/core`) não sabe de onde a mensagem veio: é regra de negócio pura, sem I/O, 100% testável. Os canais (`src/channels`) só traduzem entrada e saída: hoje existem o canal WhatsApp, um simulador web local e o **app instalável (PWA)**, um chat com login que usa exatamente o mesmo núcleo.

```
src/
  core/                 # regras de negócio puras, sem I/O, 100% testável
    parser/             # texto → transações
    commands/           # "muda pra X" e "apaga o último"
    categories/         # dicionário padrão + aprendizado por usuário
    ai/                 # schema (zod) e mapeamento da saída da IA de reserva
    auth/               # regras de acesso e validação do login
    chat/               # serviço do chat do app (histórico, limite, saldo)
    balance/            # saldo do mês
    replies/            # formatação das respostas
    message-handler.ts  # o fluxo completo, com as dependências injetadas
  services/             # supabase (dados e login), groq, gemini (I/O)
  channels/
    whatsapp/           # assinatura, leitura do webhook, envio, download de mídia
    simulator/          # chat web local que usa o mesmo núcleo
    app/                # chat do app instalável (telas, ações do servidor)
app/
  api/webhook/whatsapp/route.ts
  simulador/page.tsx
  entrar/               # login
  app/page.tsx          # o chat (só para quem entrou)
  manifest.ts           # faz o app ser instalável
proxy.ts                # renova a sessão e redireciona quem não entrou
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

| Comando              | O que faz                                                       |
| -------------------- | --------------------------------------------------------------- |
| `npm run dev`        | servidor de desenvolvimento                                     |
| `npm run build`      | build de produção                                               |
| `npm run lint`       | ESLint                                                          |
| `npm run typecheck`  | gera os tipos das rotas (`next typegen`) e checa tudo com `tsc` |
| `npm test`           | roda os testes (Vitest)                                         |
| `npm run test:watch` | testes em modo watch                                            |
| `npm run format`     | formata tudo com Prettier                                       |

## Banco de dados (Supabase)

As migrations ficam em `supabase/migrations/`, numeradas na ordem em que devem ser executadas. Por enquanto, rodar cada arquivo, na ordem, colando o SQL no **SQL Editor** do painel do Supabase:

1. `0001_create_users.sql`
2. `0002_create_transactions.sql`
3. `0003_create_learned_categories.sql`
4. `0004_create_pending_actions.sql`
5. `0005_create_processed_messages.sql`
6. `0006_create_monthly_usage.sql`
7. `0007_seed_simulator_user.sql`: cria o usuário fixo usado pelo `/simulador`
8. `0008_add_transactions_seq.sql`: coluna `seq` (numeração automática) em `transactions`. "gastei 45 no ifood e 12 no uber" grava duas linhas na mesma inserção, com o mesmo `created_at`; o `seq` desempata e define sem ambiguidade qual é a última transação (alvo de `muda pra X` e `apaga o último`)
9. `0009_add_users_auth_user_id.sql`: liga o login do app (Supabase Auth) ao usuário do bot (`users.auth_user_id`)
10. `0010_create_chat_messages.sql`: histórico do chat do app (últimas 100 mensagens por pessoa), também com `seq` para manter a ordem
11. `0011_create_budgets.sql`: orçamento mensal por categoria de gasto (`budgets`: um limite por usuário e categoria, sempre positivo, em centavos). A migration só **cria** uma tabela, então o app continua funcionando mesmo antes de ela ser executada (o aviso de orçamento só não aparece)

Todas as tabelas têm **Row Level Security (RLS)** ligado e nenhuma policy: só o backend, usando a chave secreta (`SUPABASE_SECRET_KEY`, que ignora RLS), acessa os dados. Isso é propositalmente redundante: mesmo que a chave pública vaze ou seja usada por engano em algum lugar, ninguém lê ou escreve nas tabelas.

## Variáveis de ambiente

Ver `.env.example` para a lista completa. Nenhum segredo vai pro Git, e o `.env.local` está no `.gitignore`.

Nomes de modelos de IA mudam com frequência, por isso ficam em variável de ambiente e não no código. Para a IA de reserva, `GROQ_LLM_MODEL=openai/gpt-oss-20b` funciona no plano grátis do Groq (modelo de produção com saída JSON estrita). Sem `GROQ_API_KEY` ou `GROQ_LLM_MODEL`, esse provedor simplesmente é pulado.

Se o Groq falhar (conta restrita, limite do plano grátis, erro de rede), o bot tenta o **Gemini** como segundo provedor, com `GEMINI_API_KEY` e `GEMINI_MODEL` (por exemplo `gemini-3.5-flash-lite`, modelo estável e barato). Sem nenhum dos dois, a IA de reserva fica desligada e o bot responde "não entendi". Um detalhe de privacidade: no plano grátis o Google pode usar o que é enviado ao Gemini para treinar modelos, por isso ele só é chamado quando o Groq falha, e só o texto da mensagem vai, sem identificação de quem mandou.

## O núcleo (`src/core`)

Regra de negócio pura, sem I/O, 100% testável:

- **`parser`**: reconhece frases como "gastei 45 no ifood" ou "recebi 1500 salário" por regras e devolve uma ou mais transações estruturadas, sempre em centavos inteiros.
- **`commands`**: reconhece as correções `muda pra lazer` e `apaga o último` (e variações), que sempre agem sobre a última transação do usuário, e os comandos de orçamento (`orçamento delivery 300`, `meus orçamentos`, `tira o orçamento de delivery`).
- **`budgets`**: compara o gasto do mês de cada categoria com o limite definido pela pessoa. Tudo em centavos inteiros, sem divisão decimal na decisão: **ok** até 80% do limite, **atenção** de 80% até o limite (inclusive) e **estourou** ao passar dele; a porcentagem mostrada é arredondada para baixo, então nunca aparece 100% sem ter chegado lá. Também formata as mensagens e gera o aviso que vai junto com a confirmação de um gasto.
- **`categories`**: dicionário de palavra-chave → categoria (ex.: "ifood" → Delivery). O que o usuário já corrigiu (termo → categoria, tabela `learned_categories`) tem prioridade sobre o dicionário.
- **`ai`**: valida com zod o JSON da IA de reserva e o transforma nas mesmas transações do parser. A IA só diz _o que_ foi gasto e _quando_ ("ontem", "dia 10"): o valor vira centavos pelo nosso conversor (sem float) e a data é calculada por nós em `America/Sao_Paulo`.
- **`date/sao-paulo`**: resolve "hoje", "ontem" e "dia N" no fuso de São Paulo, usando só `Intl` (sem biblioteca de datas).
- **`balance`**: soma entradas/saídas de um conjunto de transações e calcula o saldo.
- **`replies`**: formata as mensagens de resposta.
- **`message-handler.ts`**: o fluxo completo, sem importar banco nem rede: recebe as dependências (`CoreDeps`) por injeção, então os testes usam um banco em memória. Ordem de interpretação: **comando de correção → parser por regras → IA de reserva (Groq, depois Gemini) → pedir pra reformular**. A IA só entra quando o parser não entende; se todos os provedores falharem (sem chave, limite do plano grátis, timeout, JSON inválido), o bot cai no "não entendi" e nada é gravado. A ordem dos provedores é uma "corrente" (`core/ai/fallback-chain.ts`) testada sem rede.
- **`handle-message.ts`**: liga o `message-handler` aos serviços reais (Supabase, Groq e Gemini). É o mesmo código que o simulador e o WhatsApp chamam.
- **`quota`**: decide se manda a resposta ou entra em modo silencioso, e se deve avisar que está perto do limite mensal.

## Simulador

`/simulador` é um chat local que conversa com o núcleo de verdade (grava no Supabase de verdade), usando um usuário de teste fixo, e não o seu número real de WhatsApp.

Como ele grava no banco de verdade e não tem login, **só funciona fora de produção** (`npm run dev`). Na Vercel a página responde 404 e a Server Action recusa o envio, a não ser que `SIMULATOR_ENABLED=true` seja configurado de propósito (`src/channels/simulator/enabled.ts`, coberto por testes). As mensagens também têm limite de 500 caracteres.

## App instalável (PWA)

É um chat estilo WhatsApp que roda no navegador do celular e pode ser **instalado na tela inicial** (Android: "Instalar app"; iPhone: Compartilhar → "Adicionar à Tela de Início"). Conversa com o mesmo núcleo do bot: `gastei 45 no ifood`, `muda pra lazer`, `apaga o último`. O topo mostra o saldo do mês.

- **Login:** Supabase Auth com e-mail e senha. Não existe cadastro público: as contas são criadas no painel do Supabase (Authentication → Users, com o cadastro público desligado). Só entra quem o administrador liberou.
- **Liberar uma pessoa:** criar o login no painel e ligá-lo ao usuário do bot com o SQL descrito em `0009_add_users_auth_user_id.sql` (a mesma pessoa vê os mesmos dados no app e no WhatsApp). Login sem usuário ativo vê "Conta ainda não liberada".
- **Segurança:** o `proxy.ts` renova a sessão e redireciona quem não entrou, mas é só uma checagem rápida pelo cookie. A checagem de verdade (`requireAppUser`, que pergunta ao Supabase se o token vale e acha o usuário ativo) roda em toda página e em toda Server Action, porque Server Actions são endpoints que podem ser chamados direto. O RLS segue ligado sem policies e todas as consultas filtram por `user_id`. A mensagem de erro do login é sempre a mesma, para não revelar quais e-mails existem. Limite de 500 caracteres por mensagem. Nenhum conteúdo de mensagem vai para log.
- **Histórico:** as últimas 100 mensagens de cada pessoa ficam em `chat_messages`, com botão "Limpar". Como o texto é guardado como foi digitado, não escreva senhas no chat.
- **Instalável:** `app/manifest.ts` e ícones gerados por código (`/pwa-icon/[size]`). Service worker e notificações ficam para uma próxima fase.
- **Comprovante (foto ou PDF):** o botão 📎 envia um comprovante de Pix ou pagamento. No celular a foto é reduzida (até 1600 px) antes de enviar. O servidor confere o login, o tamanho (até 3 MB) e o **tipo real do arquivo pelos primeiros bytes**, e o Gemini lê valor, quem recebeu ou enviou, data e se foi entrada ou saída. Tudo é validado com zod: o valor vira centavos pelo conversor do núcleo (sem float), e data impossível, no futuro ou com mais de 13 meses é recusada. O resultado vira um **cartão com Salvar e Cancelar**: **só grava depois do Salvar**. A pendência fica na tabela `pending_actions`, vale 24 horas e é única por pessoa; ela é apagada e devolvida numa operação só do banco, então toque duplo não grava duas vezes, e se salvar falhar o comprovante volta pra tentar de novo. A imagem **nunca é armazenada**: é lida e descartada. Privacidade: no plano grátis o Google pode treinar com o que o Gemini recebe, então o arquivo vai sem identificar quem enviou, e o prompt manda ignorar CPF/CNPJ e números de conta.
- **Resumo do mês (`/app/resumo`):** o link "Resumo" no topo do chat abre uma tela só de leitura com **entrou / saiu / saldo**, os **gastos por categoria** (valor, porcentagem e barra), as **entradas por categoria** e o **extrato do mês agrupado por dia** (Hoje, Ontem, dia da semana). As setas ‹ › trocam de mês pela URL (`?mes=2026-10`): mês inválido, anterior a 2020 ou no futuro cai no mês atual, então um endereço digitado errado nunca quebra a tela. As contas ficam no núcleo (`src/core/summary`, funções puras em centavos, sem float, no fuso de São Paulo) e a consulta é uma só, filtrada por `user_id` (`getMonthStatement`, até 1.000 lançamentos por mês). As barras são só CSS: sem biblioteca de gráfico. Corrigir ou apagar um lançamento continua sendo pelo chat (`muda pra lazer`, `apaga o último`).
- **Orçamentos por categoria:** pelo chat, `orçamento delivery 300` (ou `limite de mercado 800,50`) define quanto você quer gastar por mês naquela categoria; `meus orçamentos` lista como o mês está e `tira o orçamento de delivery` remove. Só categorias de **gasto** têm orçamento, e o valor vale todo mês (ao olhar um mês antigo no Resumo, ele é comparado com o limite atual). Ao registrar um gasto numa categoria que chegou a 80% do limite ou passou dele (por texto ou ao salvar um comprovante), a resposta ganha **uma linha extra** (`⚠️ Delivery: R$ 270,00 de R$ 300,00 (90%)` ou `🚨 ... · passou R$ 20,00`). É a mesma resposta de sempre, então no WhatsApp não gasta cota. O Resumo ganha um bloco "Orçamentos" com barra de progresso e legenda por escrito (a cor sozinha nunca é a única pista). Os orçamentos são um **extra**: se a leitura deles falhar, o gasto é registrado e a resposta sai normal (só o tipo do erro vai para o log, nunca valores).

## WhatsApp (`src/channels/whatsapp` + `app/api/webhook/whatsapp`)

- **`verify-signature`**: valida o `X-Hub-Signature-256` (HMAC SHA-256 com o App Secret) sobre o corpo cru da requisição.
- **`phone`**: o `wa_id` pode chegar com ou sem o nono dígito; gera as duas formas pra comparar com a tabela `users`, e mascara o telefone pra log seguro.
- **`parse-webhook`**: extrai as mensagens do payload da Meta (ignora eventos de status como "entregue"/"lido") e traduz pro formato normalizado do núcleo.
- **`send-message`**: envia texto pela Graph API. Não existe função de template (proibido: geraria cobrança e o bot só responde dentro da janela de 24h de uma mensagem recebida).
- **`route.ts`**: `GET` faz o handshake de verificação do webhook; `POST` valida a assinatura, responde `200` na hora e processa a mensagem depois com `after()` (idempotência por `wa_message_id` → número autorizado e ativo → núcleo → cota → envia).

## Deploy (Vercel) e configuração na Meta

1. Conectar o repositório na Vercel (plano Hobby) e configurar lá as mesmas variáveis do `.env.local` (nunca copiar o `.env.local` em si, só os valores).
2. No painel da Meta, em **WhatsApp → Configuração da API → Webhook**:
   - Callback URL: `https://<seu-projeto>.vercel.app/api/webhook/whatsapp`
   - Verify token: o mesmo valor de `WHATSAPP_VERIFY_TOKEN`
   - Assinar o campo **`messages`**

## Estado atual

**Fases 1 a 4 implementadas:** fundação, núcleo (parser/categorias/saldo/respostas), simulador, a integração com o WhatsApp (webhook, assinatura, números autorizados, idempotência, cota e modo silencioso), a IA de reserva (Groq) e as correções com aprendizado de categoria por usuário. Falta apenas o teste ponta a ponta com o WhatsApp real (Fase 3). Testes automatizados cobrem os exemplos de mensagem do escopo do projeto, os comandos, as categorias aprendidas, a IA de reserva (com `fetch` simulado), a verificação de assinatura e a lógica de cota.

**App instalável com login e chat** (Fase B do plano do app), **comprovante por foto ou PDF** (Fase C1), **resumo do mês com extrato** (Fase A) e **orçamentos por categoria**: implementados. Próximas: mensagem de voz (Fase C2), compartilhar do banco/WhatsApp para o app (só Android) e notificações.

---

Feito por **Kauê Souza**. Para conversar, me chame no [LinkedIn](https://www.linkedin.com/in/kauesouzaproti/).
