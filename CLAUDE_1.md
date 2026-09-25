# Bot Financeiro no WhatsApp

Instruções para o Claude Code. Leia o arquivo inteiro antes de começar qualquer fase.

## O projeto

Bot de finanças pessoais no WhatsApp. A pessoa manda "gastei 45 no ifood", um áudio ou a foto de um comprovante PIX, e o bot registra, categoriza e responde com o saldo do mês.

- **Usuários:** o Kauê e, se ela quiser, a namorada dele. No máximo 5 números (limite do número de teste da Meta). Cada pessoa só enxerga os próprios dados.
- **Dois objetivos com o mesmo peso:** uso real no dia a dia e portfólio para a primeira vaga de dev full stack. Código limpo, testes e README contam tanto quanto funcionar.
- **Restrição inegociável: custo zero.** Nenhuma decisão pode criar custo. Na dúvida, pergunte antes.

## Stack (não trocar sem perguntar)

| Parte | Escolha |
|---|---|
| App + API | Next.js (App Router) + TypeScript `strict`, deploy na Vercel (plano Hobby) |
| Banco | Supabase (Postgres), projeto próprio, separado de outros projetos |
| WhatsApp | WhatsApp Cloud API oficial da Meta, com o número de teste |
| Áudio → texto | Groq, modelo Whisper |
| IA de reserva (texto) | Groq, LLM com saída JSON |
| Foto de comprovante | Gemini via `@google/genai` |
| Validação | zod |
| Testes e CI | Vitest + GitHub Actions (lint, typecheck e testes) |

Nomes de modelos de IA e a versão da Graph API mudam com frequência. Eles ficam em variáveis de ambiente, nunca fixos no código. Antes de usar um SDK, confira a documentação atual.

## Ambiente do Kauê

- Windows, VS Code e Git. A Vercel faz deploy automático a cada push na `main`.
- Evite comandos que só funcionam em Linux/macOS. Se precisar de um, avise.
- O Kauê está no começo da carreira: explique as decisões em linguagem simples. Ele vai precisar defender o projeto em entrevista.

## Arquitetura

O núcleo não sabe de onde a mensagem veio. Os canais (WhatsApp e simulador web) só traduzem a entrada e a saída.

```
src/
  core/                 # regras de negócio puras, sem I/O, 100% testável
    parser/             # texto → transações
    categories/         # dicionário padrão + aprendizado por usuário
    balance/            # saldo do mês
    replies/            # formatação das respostas
    handle-message.ts   # ponto de entrada do núcleo
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

- Entrada normalizada: `{ userId, kind: 'text' | 'audio' | 'image' | 'button', content }`.
- Saída normalizada: lista de respostas (`text` ou `buttons`). O canal decide como enviar.
- Código (variáveis, funções, tabelas) em inglês. Tudo que o usuário lê fica em português.

## Regras de negócio

- **Dinheiro sempre em centavos (inteiro).** Nunca `float`.
- **Fuso `America/Sao_Paulo`** para "mês", "hoje", "ontem" e datas.
- O parser precisa entender, no mínimo:
  - `gastei 45 no ifood` · `45,90 mercado` · `uber 23 ontem` · `R$ 1.234,56 aluguel`
  - `gastei 30 reais no mercado` · `20 conto no lanche`
  - `recebi 1500 salário` · `paguei 120 de luz dia 10`
  - `gastei 45 no ifood e 12 no uber` (várias transações na mesma mensagem)
- Categorias padrão:
  - Saídas: Alimentação, Delivery, Mercado, Transporte, Moradia, Contas, Saúde, Lazer, Educação, Compras, Assinaturas, Outros
  - Entradas: Salário, Freela, Pix recebido, Outras entradas
- Ordem de interpretação do texto: **parser por regras → IA de reserva (Groq, JSON validado com zod) → pedir para reformular, com um exemplo.** A IA só entra quando o parser falha.
- Correções que o bot entende: `muda pra lazer` e `apaga o último`, sempre sobre a última transação do usuário. Quando o usuário corrige uma categoria, o bot guarda termo → categoria para esse usuário e usa nas próximas vezes.
- **Áudio:** baixa → Whisper (idioma `pt`) → mesmo fluxo do texto. A resposta mostra o que foi entendido.
- **Foto:** baixa → Gemini extrai `{ amount, recipient, date, kind }` (validado com zod) → o bot pede confirmação com os botões **Salvar** e **Cancelar** → só grava depois do "Salvar". A pendência expira em 24h.
- Mídia (áudio e foto) nunca é armazenada: baixa, processa e descarta.
- Formato da resposta padrão:

  ```
  ✅ R$ 45,00 em Delivery (ifood)
  Setembro: entrou R$ 1.500,00 · saiu R$ 623,40 · saldo R$ 876,60
  ```

## WhatsApp e a cota grátis (regras críticas)

- **Uma resposta por mensagem recebida.** Várias transações na mesma mensagem geram uma resposta só.
- O bot **só responde** a mensagens recebidas, dentro da janela de 24h. **Nunca** envia template nem mensagem por iniciativa própria, porque template é cobrado. Não crie função de envio de template.
- A Meta dá **1.000 respostas grátis por mês** para o número do bot, divididas entre todos os usuários. Use uma tabela de uso mensal:
  - Ao chegar em 90% de `MONTHLY_REPLY_LIMIT`, avisa o usuário junto com a próxima resposta.
  - Ao atingir o limite, entra em **modo silencioso**: continua registrando, mas não responde até o mês virar.
- Só atende números cadastrados e ativos na tabela `users`. Qualquer outro número é ignorado, sem resposta.
- **Telefone brasileiro:** o `wa_id` pode chegar com ou sem o nono dígito. Ao comparar com a tabela, considere as duas formas. Para responder, use o `wa_id` exatamente como chegou.
- **Webhook:**
  - `GET`: confere o `hub.verify_token` e devolve o `hub.challenge`.
  - `POST`: valida o `X-Hub-Signature-256` (HMAC SHA-256 com o App Secret) sobre o corpo cru (`req.text()`), antes do `JSON.parse`. Compare com `timingSafeEqual`.
  - Responde `200` na hora e processa depois com `after()` do Next.js.
  - Idempotência: a Meta pode reenviar o mesmo evento. Guarde o id da mensagem com `unique` e ignore repetidas.
  - Eventos de status (enviado, entregue, lido) são ignorados.
- **Escopo:** é um bot de finanças. A IA só extrai dados; não existe conversa livre. Desde janeiro de 2026 a Meta proíbe chatbots de IA de uso geral na API.

## Segurança e privacidade

- Segredos só em variáveis de ambiente. O `.env.local` nunca vai pro Git; o `.env.example` tem só os nomes.
- A chave secreta do Supabase só existe no servidor. RLS ativado em todas as tabelas.
- Em produção, nunca logar conteúdo de mensagem, valores ou telefone completo. Mascare o telefone (`5524*****4137`).
- No plano grátis do Gemini, o Google pode usar o que for enviado para treinar modelos. Mande só a imagem, sem dados do usuário junto.
- O repositório é público: nada de dado real em testes, seeds ou prints.

## Modelo de dados inicial

- `users`: `id uuid`, `phone text unique` (E.164, só dígitos), `name`, `active bool`, `created_at`
- `transactions`: `id uuid`, `user_id → users`, `type 'income' | 'expense'`, `amount_cents int > 0`, `description`, `category`, `occurred_on date`, `source 'text' | 'audio' | 'image' | 'simulator'`, `created_at`
- `learned_categories`: `user_id`, `term`, `category`, `unique (user_id, term)`
- `processed_messages`: `wa_message_id text primary key`, `received_at`
- `monthly_usage`: `month text primary key` (`YYYY-MM`), `replies_sent int`
- `pending_actions`: `id uuid`, `user_id`, `kind 'confirm_image'`, `payload jsonb`, `expires_at`

Ajustes são bem-vindos se melhorarem o design. Explique o motivo.

## Variáveis de ambiente

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_API_VERSION=
MONTHLY_REPLY_LIMIT=950

GROQ_API_KEY=
GROQ_WHISPER_MODEL=
GROQ_LLM_MODEL=
GEMINI_API_KEY=
GEMINI_MODEL=
```

## Como trabalhar

1. Uma fase por vez. Antes de codar, mostre o plano da fase em tópicos e **espere o OK do Kauê**.
2. Ao terminar a fase: rode lint, typecheck e testes, atualize o README, liste o que o Kauê deve testar na mão e **espere a aprovação** antes de seguir.
3. Commits pequenos no padrão Conventional Commits, com a mensagem em português (`feat: parser entende valores com vírgula`).
4. Testes obrigatórios no núcleo: parser, categorias, saldo, cota e verificação de assinatura.
5. Não adicione serviço pago nem dependência pesada sem perguntar.

## Fases do MVP

**Fase 1: Fundação**
Next.js + TS strict, ESLint + Prettier, Vitest, estrutura de pastas, cliente Supabase, migrations do modelo de dados (com RLS), `.env.example`, CI no GitHub Actions e README inicial.
*Pronto quando:* `npm test` passa, o CI fica verde e as tabelas existem no Supabase.

**Fase 2: Núcleo + simulador**
Parser, categorias, saldo e respostas. Página `/simulador` (só local por enquanto) conversando com o núcleo com um usuário de teste.
*Pronto quando:* todos os exemplos das regras de negócio passam nos testes e funcionam no simulador.

**Fase 3: WhatsApp**
Webhook completo, lista de números autorizados, envio de texto, idempotência, cota e modo silencioso. Deploy na Vercel com as variáveis de ambiente configuradas lá. No painel da Meta: Callback URL `https://<projeto>.vercel.app/api/webhook/whatsapp`, o verify token e a assinatura do campo `messages`.
*Pronto quando:* "gastei 45 no ifood" mandado pelo WhatsApp grava e responde com o saldo, e um número fora da lista é ignorado.

**Fase 4: IA de reserva e correções**
Groq quando o parser falha, `muda pra X`, `apaga o último` e aprendizado de categoria por usuário.
*Pronto quando:* frases fora do padrão são entendidas e uma correção vale para as próximas mensagens.

**Fase 5: Áudio**
Download da mídia pela Graph API, transcrição no Whisper e o mesmo fluxo do texto.
*Pronto quando:* um áudio dizendo "gastei trinta reais no mercado" vira transação.

**Fase 6: Foto do comprovante**
Gemini com saída JSON, botões Salvar/Cancelar e pendência com validade.
*Pronto quando:* a foto de um comprovante PIX real vira transação só depois do "Salvar".

## Depois do MVP (não fazer ainda)

Painel web com login · simulador público no portfólio (dados de exemplo + limite de uso) · resumo semanal entregue quando a janela de 24h abrir · alerta de gasto fora do padrão (ML no GitHub Actions) · gastos do casal · README de portfólio com GIF e diagrama da arquitetura.
