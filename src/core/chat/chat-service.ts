import {
  PENDING_RECEIPT_TTL_MS,
  RECEIPT_ALLOWED_MIME_TYPES,
  RECEIPT_MAX_BYTES,
  RECEIPT_MESSAGES,
  formatReceiptPrompt,
  formatReceiptSummary,
  receiptToPendingTransaction,
  type ReceiptExtraction,
} from "../ai/receipt";
import { calculateBalance } from "../balance/calculate-balance";
import { getBudgetAlertLines } from "../budgets/budget-alerts";
import type { Budget, CategorizedTransaction } from "../budgets/budget-status";
import type { LearnedCategories } from "../categories";
import { getSaoPauloParts } from "../date/sao-paulo";
import { formatBalance, formatConfirmation } from "../replies/format-reply";
import type { CoreInput, CoreReply, ParsedTransaction, TransactionSource } from "../types";

export const MAX_CHAT_MESSAGE_LENGTH = 500;
export const CHAT_HISTORY_LIMIT = 100;

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
}

export interface NewChatMessage {
  role: "user" | "bot";
  text: string;
}

// Arquivo de comprovante que chegou ao servidor. Nunca é gravado em lugar nenhum: é lido e descartado.
export interface ReceiptFile {
  mimeType: string;
  bytes: Uint8Array;
}

// Transação lida de um comprovante, esperando a pessoa tocar em Salvar.
export interface PendingReceipt {
  id: string;
  transaction: ParsedTransaction;
  expiresAt: Date;
}

export interface PendingView {
  id: string;
  summary: string;
}

// Tudo que o chat precisa do "mundo de fora" entra por aqui: o núcleo do bot, o histórico, o saldo e o comprovante.
export interface ChatDeps {
  handleMessage(input: CoreInput): Promise<CoreReply[]>;
  listMessages(userId: string, limit: number): Promise<ChatMessage[]>;
  appendMessages(userId: string, messages: NewChatMessage[]): Promise<void>;
  clearMessages(userId: string): Promise<void>;
  getMonthTransactions(
    userId: string,
    year: number,
    month: number,
  ): Promise<CategorizedTransaction[]>;
  getBudgets(userId: string): Promise<Budget[]>;
  getLearnedCategories(userId: string): Promise<LearnedCategories>;
  insertTransactions(
    userId: string,
    transactions: ParsedTransaction[],
    source: TransactionSource,
  ): Promise<void>;
  // IA que lê o comprovante. Devolve null se falhar (nunca deve lançar erro).
  extractReceipt(file: ReceiptFile): Promise<ReceiptExtraction | null>;
  // Cada pessoa tem no máximo uma pendência: guardar uma nova substitui a anterior.
  replacePending(
    userId: string,
    transaction: ParsedTransaction,
    expiresAt: Date,
  ): Promise<PendingReceipt>;
  getPending(userId: string, now: Date): Promise<PendingReceipt | null>;
  // Pega e apaga a pendência numa operação só (atômica): impede salvar duas vezes com dois toques.
  takePending(userId: string, pendingId: string, now: Date): Promise<PendingReceipt | null>;
  clearPending(userId: string): Promise<void>;
  now(): Date;
}

export interface ChatView {
  messages: ChatMessage[];
  balanceLine: string;
  pending: PendingView | null;
}

export type SendResult =
  | { ok: true; userText: string; botText: string; balanceLine: string }
  | { ok: false; error: string };

export type ReceiptResult =
  | { ok: true; userText: string; botText: string; pending: PendingView }
  | { ok: false; error: string };

export type PendingResult =
  { ok: true; botText: string; balanceLine: string } | { ok: false; error: string };

function toPendingView(pending: PendingReceipt): PendingView {
  return { id: pending.id, summary: formatReceiptSummary(pending.transaction) };
}

function isAllowedMimeType(mimeType: string): boolean {
  return (RECEIPT_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function createChatService(deps: ChatDeps) {
  async function balanceLine(userId: string): Promise<string> {
    const today = getSaoPauloParts(deps.now());
    const transactions = await deps.getMonthTransactions(userId, today.year, today.month);
    return formatBalance(calculateBalance(transactions), today);
  }

  // Nunca loga o conteúdo da mensagem nem do comprovante, só o tipo do erro.
  function logError(error: unknown): void {
    console.error("Erro no chat do app:", error instanceof Error ? error.name : "desconhecido");
  }

  return {
    async loadChat(userId: string): Promise<ChatView> {
      const [messages, line, pending] = await Promise.all([
        deps.listMessages(userId, CHAT_HISTORY_LIMIT),
        balanceLine(userId),
        deps.getPending(userId, deps.now()),
      ]);
      return { messages, balanceLine: line, pending: pending ? toPendingView(pending) : null };
    },

    // Mesma entrada do WhatsApp e do simulador: o núcleo não sabe de onde a mensagem veio.
    async sendMessage(userId: string, rawText: string): Promise<SendResult> {
      const text = rawText.trim();
      if (!text) return { ok: false, error: "Escreva uma mensagem." };
      if (text.length > MAX_CHAT_MESSAGE_LENGTH) {
        return {
          ok: false,
          error: `Mensagem muito longa. Mande até ${MAX_CHAT_MESSAGE_LENGTH} caracteres.`,
        };
      }

      try {
        const replies = await deps.handleMessage({
          userId,
          kind: "text",
          content: text,
          source: "text",
        });
        const botText = replies.map((reply) => reply.text).join("\n\n");

        await deps.appendMessages(userId, [
          { role: "user", text },
          { role: "bot", text: botText },
        ]);

        return { ok: true, userText: text, botText, balanceLine: await balanceLine(userId) };
      } catch (error) {
        logError(error);
        return { ok: false, error: "Não consegui processar agora. Tente de novo em instantes." };
      }
    },

    // Lê um comprovante e guarda o resultado como pendência. NADA é gravado como transação
    // até a pessoa tocar em Salvar (confirmPending).
    async sendReceipt(userId: string, file: ReceiptFile): Promise<ReceiptResult> {
      if (
        !isAllowedMimeType(file.mimeType) ||
        file.bytes.length === 0 ||
        file.bytes.length > RECEIPT_MAX_BYTES
      ) {
        return { ok: false, error: RECEIPT_MESSAGES.invalidFile };
      }

      try {
        const extraction = await deps.extractReceipt(file);
        if (!extraction) return { ok: false, error: RECEIPT_MESSAGES.failed };

        const now = deps.now();
        const learned = await deps.getLearnedCategories(userId);
        const mapping = receiptToPendingTransaction(extraction, learned, now);
        if (!mapping.ok) {
          const messages = {
            not_receipt: RECEIPT_MESSAGES.notReceipt,
            unreadable: RECEIPT_MESSAGES.unreadable,
            bad_date: RECEIPT_MESSAGES.badDate,
          } as const;
          return { ok: false, error: messages[mapping.reason] };
        }

        const pending = await deps.replacePending(
          userId,
          mapping.transaction,
          new Date(now.getTime() + PENDING_RECEIPT_TTL_MS),
        );

        const userText = "📎 Comprovante enviado";
        const botText = formatReceiptPrompt(mapping.transaction);
        await deps.appendMessages(userId, [
          { role: "user", text: userText },
          { role: "bot", text: botText },
        ]);

        return { ok: true, userText, botText, pending: toPendingView(pending) };
      } catch (error) {
        logError(error);
        return { ok: false, error: RECEIPT_MESSAGES.failed };
      }
    },

    // Toque em "Salvar": só agora a transação é gravada.
    async confirmPending(userId: string, pendingId: string): Promise<PendingResult> {
      try {
        const now = deps.now();
        const pending = await deps.takePending(userId, pendingId, now);
        if (!pending) return { ok: false, error: RECEIPT_MESSAGES.alreadyHandled };

        try {
          await deps.insertTransactions(userId, [pending.transaction], "image");
        } catch (error) {
          // Não perde o comprovante: devolve a pendência pra pessoa poder tentar de novo.
          await deps.replacePending(userId, pending.transaction, pending.expiresAt);
          throw error;
        }

        // Mesma regra do chat de texto: o saldo e o aviso de orçamento saem de uma consulta só.
        const today = getSaoPauloParts(now);
        const monthTransactions = await deps.getMonthTransactions(userId, today.year, today.month);
        const budgetAlerts = await getBudgetAlertLines({
          loadBudgets: () => deps.getBudgets(userId),
          monthTransactions,
          saved: [pending.transaction],
          month: today,
        });
        const line = formatBalance(calculateBalance(monthTransactions), today);
        const botText = [formatConfirmation(pending.transaction), ...budgetAlerts, line].join("\n");
        await deps.appendMessages(userId, [{ role: "bot", text: botText }]);

        return { ok: true, botText, balanceLine: line };
      } catch (error) {
        logError(error);
        return { ok: false, error: "Não consegui salvar agora. Tente de novo em instantes." };
      }
    },

    // Toque em "Cancelar": descarta a pendência sem gravar nada.
    async cancelPending(userId: string, pendingId: string): Promise<PendingResult> {
      try {
        const pending = await deps.takePending(userId, pendingId, deps.now());
        if (!pending) return { ok: false, error: RECEIPT_MESSAGES.alreadyHandled };

        await deps.appendMessages(userId, [{ role: "bot", text: RECEIPT_MESSAGES.cancelled }]);
        return {
          ok: true,
          botText: RECEIPT_MESSAGES.cancelled,
          balanceLine: await balanceLine(userId),
        };
      } catch (error) {
        logError(error);
        return { ok: false, error: "Não consegui cancelar agora. Tente de novo em instantes." };
      }
    },

    async clear(userId: string): Promise<void> {
      await deps.clearMessages(userId);
      await deps.clearPending(userId);
    },
  };
}
