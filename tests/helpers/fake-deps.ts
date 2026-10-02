import type { CoreDeps } from "@/core/message-handler";
import type { StoredTransaction } from "@/core/types";

// Terça, 2026-09-15 (meio-dia em SP). Fixa pra "setembro" e "ontem" não dependerem do dia do teste.
export const NOW = new Date("2026-09-15T15:00:00Z");

// Banco em memória pros testes do núcleo: mesma ideia do Supabase, sem rede e sem dado real.
export function createFakeStore(initialLearned: Record<string, string> = {}) {
  const transactions: StoredTransaction[] = [];
  const learned: Record<string, string> = { ...initialLearned };
  let nextId = 1;

  const deps: CoreDeps = {
    insertTransactions: async (_userId, newTransactions) => {
      for (const transaction of newTransactions) {
        transactions.push({ id: `tx-${nextId++}`, ...transaction });
      }
    },
    getMonthTransactions: async () =>
      transactions.map((transaction) => ({
        type: transaction.type,
        amountCents: transaction.amountCents,
      })),
    getLastTransaction: async () => transactions.at(-1) ?? null,
    updateTransactionCategory: async (_userId, transactionId, category) => {
      const transaction = transactions.find((item) => item.id === transactionId);
      if (transaction) transaction.category = category;
    },
    deleteTransaction: async (_userId, transactionId) => {
      const index = transactions.findIndex((item) => item.id === transactionId);
      if (index >= 0) transactions.splice(index, 1);
    },
    getLearnedCategories: async () => ({ ...learned }),
    saveLearnedCategory: async (_userId, term, category) => {
      learned[term] = category;
    },
    now: () => NOW,
  };

  return { deps, transactions, learned };
}
