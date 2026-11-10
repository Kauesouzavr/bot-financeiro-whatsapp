import type { BalanceTransaction } from "../balance/calculate-balance";
import { calculateBalance } from "../balance/calculate-balance";
import { getSaoPauloParts } from "../date/sao-paulo";
import { formatBalance } from "../replies/format-reply";
import type { CoreInput, CoreReply } from "../types";

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

// Tudo que o chat precisa do "mundo de fora" entra por aqui: o núcleo do bot, o histórico e o saldo.
export interface ChatDeps {
  handleMessage(input: CoreInput): Promise<CoreReply[]>;
  listMessages(userId: string, limit: number): Promise<ChatMessage[]>;
  appendMessages(userId: string, messages: NewChatMessage[]): Promise<void>;
  clearMessages(userId: string): Promise<void>;
  getMonthTransactions(userId: string, year: number, month: number): Promise<BalanceTransaction[]>;
  now(): Date;
}

export interface ChatView {
  messages: ChatMessage[];
  balanceLine: string;
}

export type SendResult =
  | { ok: true; userText: string; botText: string; balanceLine: string }
  | { ok: false; error: string };

export function createChatService(deps: ChatDeps) {
  async function balanceLine(userId: string): Promise<string> {
    const today = getSaoPauloParts(deps.now());
    const transactions = await deps.getMonthTransactions(userId, today.year, today.month);
    return formatBalance(calculateBalance(transactions), today);
  }

  return {
    async loadChat(userId: string): Promise<ChatView> {
      const [messages, line] = await Promise.all([
        deps.listMessages(userId, CHAT_HISTORY_LIMIT),
        balanceLine(userId),
      ]);
      return { messages, balanceLine: line };
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
        // Nunca loga o conteúdo da mensagem, só o tipo do erro.
        console.error("Erro no chat do app:", error instanceof Error ? error.name : "desconhecido");
        return { ok: false, error: "Não consegui processar agora. Tente de novo em instantes." };
      }
    },

    async clear(userId: string): Promise<void> {
      await deps.clearMessages(userId);
    },
  };
}
