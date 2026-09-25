# Passo a passo: contas e chaves (Fase 0)

Faz isso antes de abrir o Claude Code. Tudo aqui é grátis. O único cartão é o da Meta, que só cobra se o bot passar de 1.000 respostas no mês, e o próprio bot trava antes disso.

Vai anotando cada valor num bloco de notas. Na Fase 1, eles vão pro arquivo `.env.local` que o Claude Code vai criar. **Nunca** mande esses valores pra ninguém nem cole no GitHub.

Os nomes dos modelos de IA e a versão da API da Meta não precisam ser anotados: o Claude Code preenche na Fase 1, conferindo a documentação atual.

Os nomes dos menus mudam de vez em quando. Se algum não bater, procura pelo nome mais parecido.

## 1. GitHub

1. Cria um repositório **público** chamado `bot-financeiro-whatsapp`.
2. Clona no teu PC (no VS Code: Clone Repository).
3. Coloca o `CLAUDE.md` na raiz da pasta e este arquivo em `docs/SETUP.md`.

## 2. Supabase

1. Em supabase.com, clica em **New project** (plano Free). Dá pra ter 2 projetos ativos de graça: a sapataria e este.
2. Região: **South America (São Paulo)**.
3. Guarda a senha do banco num lugar seguro.
4. Em **Project Settings → API Keys**, copia:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key (ou "anon", se aparecer o nome antigo) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key (ou "service_role") → `SUPABASE_SECRET_KEY`

## 3. Groq (áudio e IA de reserva)

1. Cria a conta em console.groq.com.
2. **API Keys → Create API Key** → `GROQ_API_KEY`

## 4. Google AI Studio (foto do comprovante)

1. Entra em aistudio.google.com com tua conta Google.
2. **Get API key → Create API key** → `GEMINI_API_KEY`

## 5. Meta (WhatsApp)

É a parte mais longa. Reserva uns 30 minutos.

### 5.1 Criar o app

1. Entra em developers.facebook.com com teu Facebook e aceita os termos de desenvolvedor.
2. **Meus apps → Criar app** → escolhe o caso de uso do **WhatsApp** (algo como "Conectar-se com clientes pelo WhatsApp").
3. Quando pedir um portfólio empresarial, cria um com teu nome.
4. A Meta cria sozinha um **número de teste** pro bot.

### 5.2 Anotar os IDs

Em **WhatsApp → Configuração da API** (ou "API Setup"):

- Phone number ID → `WHATSAPP_PHONE_NUMBER_ID`
- WhatsApp Business Account ID → `WHATSAPP_BUSINESS_ACCOUNT_ID`

### 5.3 Cadastrar quem pode conversar com o bot

1. No campo **Para** (ou "To"), adiciona o teu número.
2. Chega um código no teu WhatsApp. Digita ele no painel.
3. Se a tua namorada quiser usar, repete com o número dela. O código chega no WhatsApp dela, e ela te passa. Dá pra cadastrar até 5 números.

### 5.4 Cadastrar o cartão (obrigatório a partir de 1º/10)

1. Entra em business.facebook.com → **Cobrança e pagamentos**.
2. Adiciona o cartão como forma de pagamento da **conta do WhatsApp**.
3. Dica: se o teu banco tiver cartão virtual, cria um só pra isso, com limite baixo.

### 5.5 Token permanente

O token que aparece no painel expira rápido. Pra criar um que não expira:

1. Em business.facebook.com → **Configurações → Usuários → Usuários do sistema → Adicionar**, com função **Admin**.
2. **Atribuir ativos:** o teu app e a tua conta do WhatsApp, com controle total.
3. **Gerar token** → escolhe o app → validade **Nunca** → marca as permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
4. Copia na hora, porque ele só aparece uma vez → `WHATSAPP_ACCESS_TOKEN`

### 5.6 Chave secreta do app

Em developers.facebook.com → teu app → **Configurações do app → Básico → Chave secreta do app** → `WHATSAPP_APP_SECRET`

### 5.7 Senha do webhook

Inventa uma senha longa qualquer → `WHATSAPP_VERIFY_TOKEN`

O webhook em si fica pra Fase 3, depois do deploy na Vercel.

## 6. Vercel

Cria a conta em vercel.com usando o GitHub (plano Hobby). O projeto a gente conecta na Fase 3.

## Tudo anotado?

Abre o Claude Code na pasta do projeto e manda:

> Leia o CLAUDE.md. Vamos começar pela Fase 1. Antes de escrever código, me mostre o plano da fase em tópicos e espere meu OK.
