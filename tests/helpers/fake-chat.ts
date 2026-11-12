import { vi } from "vitest";
import type { ReceiptExtraction } from "@/core/ai/receipt";
import type { Budget } from "@/core/budgets/budget-status";
import {
  createChatService,
  type ChatDeps,
  type ChatMessage,
  type PendingReceipt,
  type ReceiptFile,
} from "@/core/chat/chat-service";
import type { CoreInput, CoreReply, ParsedTransaction, TransactionSource } from "@/core/types";
import { NOW } from "./fake-deps";

export interface FakeChatOptions {
  replies?: CoreReply[];
  handleError?: Error;
  extraction?: ReceiptExtraction | null;
  learned?: Record<string, string>;
  insertError?: Error;
  budgets?: Budget[];
  budgetsError?: Error;
}

// Tudo em memória, no mesmo espírito do banco real, mas sem rede e sem dado de verdade.
export function createFakeChat(options: FakeChatOptions = {}) {
  const stored: { userId: string; role: string; text: string }[] = [];
  const handled: CoreInput[] = [];
  const inserted: { userId: string; transaction: ParsedTransaction; source: TransactionSource }[] =
    [];
  const extracted: ReceiptFile[] = [];
  const pendings: (PendingReceipt & { userId: string })[] = [];
  const clock = { now: NOW };
  const control = {
    extraction: options.extraction ?? (null as ReceiptExtraction | null),
    insertError: options.insertError ?? (null as Error | null),
  };
  let nextPendingId = 1;

  const view = (pending: PendingReceipt & { userId: string }): PendingReceipt => ({
    id: pending.id,
    transaction: pending.transaction,
    expiresAt: pending.expiresAt,
  });

  const deps: ChatDeps = {
    handleMessage: async (input) => {
      handled.push(input);
      if (options.handleError) throw options.handleError;
      return options.replies ?? [{ type: "text", text: "✅ R$ 45,00 em Delivery (ifood)" }];
    },
    listMessages: vi.fn(async (userId: string): Promise<ChatMessage[]> =>
      stored
        .filter((message) => message.userId === userId)
        .map((message, index) => ({
          id: `m-${index}`,
          role: message.role as ChatMessage["role"],
          text: message.text,
        })),
    ),
    appendMessages: async (userId, messages) => {
      for (const message of messages) stored.push({ userId, ...message });
    },
    clearMessages: async (userId) => {
      for (let i = stored.length - 1; i >= 0; i--)
        if (stored[i].userId === userId) stored.splice(i, 1);
    },
    // Saldo-base fixo (entrou R$ 1.500,00 e saiu R$ 45,00) mais o que foi salvo durante o teste.
    getMonthTransactions: async (userId) => [
      { type: "income", amountCents: 150000, category: "Salário" },
      { type: "expense", amountCents: 4500, category: "Delivery" },
      ...inserted
        .filter((item) => item.userId === userId)
        .map((item) => ({
          type: item.transaction.type,
          amountCents: item.transaction.amountCents,
          category: item.transaction.category,
        })),
    ],
    getBudgets: async () => {
      if (options.budgetsError) throw options.budgetsError;
      return options.budgets ?? [];
    },
    getLearnedCategories: async () => options.learned ?? {},
    insertTransactions: async (userId, transactions, source) => {
      if (control.insertError) throw control.insertError;
      for (const transaction of transactions) inserted.push({ userId, transaction, source });
    },
    extractReceipt: async (file) => {
      extracted.push(file);
      return control.extraction;
    },
    replacePending: async (userId, transaction, expiresAt) => {
      for (let i = pendings.length - 1; i >= 0; i--)
        if (pendings[i].userId === userId) pendings.splice(i, 1);
      const pending = {
        id: `00000000-0000-4000-8000-${String(nextPendingId++).padStart(12, "0")}`,
        userId,
        transaction,
        expiresAt,
      };
      pendings.push(pending);
      return view(pending);
    },
    getPending: async (userId, now) => {
      const pending = pendings.find((item) => item.userId === userId && item.expiresAt > now);
      return pending ? view(pending) : null;
    },
    takePending: async (userId, pendingId, now) => {
      const index = pendings.findIndex(
        (item) => item.id === pendingId && item.userId === userId && item.expiresAt > now,
      );
      if (index < 0) return null;
      const [pending] = pendings.splice(index, 1);
      return view(pending);
    },
    clearPending: async (userId) => {
      for (let i = pendings.length - 1; i >= 0; i--)
        if (pendings[i].userId === userId) pendings.splice(i, 1);
    },
    now: () => clock.now,
  };

  return {
    service: createChatService(deps),
    deps,
    stored,
    handled,
    inserted,
    extracted,
    pendings,
    clock,
    control,
  };
}
