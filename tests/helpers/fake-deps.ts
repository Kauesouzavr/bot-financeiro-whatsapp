import type { AiExtraction } from "@/core/ai/extraction";
import type { Budget } from "@/core/budgets/budget-status";
import type { CoreDeps } from "@/core/message-handler";
import type { StoredTransaction } from "@/core/types";

// Terça, 2026-09-15 (meio-dia em SP). Fixa pra "setembro" e "ontem" não dependerem do dia do teste.
export const NOW = new Date("2026-09-15T15:00:00Z");

// Banco em memória pros testes do núcleo: mesma ideia do Supabase, sem rede e sem dado real.
export function createFakeStore(
  initialLearned: Record<string, string> = {},
  initialBudgets: Budget[] = [],
) {
  const transactions: StoredTransaction[] = [];
  const learned: Record<string, string> = { ...initialLearned };
  const budgets: Budget[] = initialBudgets.map((budget) => ({ ...budget }));
  // Faz a leitura dos orçamentos falhar, como acontece se a tabela ainda não existir no banco.
  const failures = { getBudgets: null as Error | null };
  let nextId = 1;

  // IA simulada: o teste define o que ela "responde" (aiResult) e confere se foi chamada (aiCalls).
  const ai = { result: null as AiExtraction | null, calls: [] as string[] };

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
        category: transaction.category,
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
    getBudgets: async () => {
      if (failures.getBudgets) throw failures.getBudgets;
      return budgets.map((budget) => ({ ...budget }));
    },
    setBudget: async (_userId, category, limitCents) => {
      const existing = budgets.find((budget) => budget.category === category);
      if (existing) existing.limitCents = limitCents;
      else budgets.push({ category, limitCents });
    },
    removeBudget: async (_userId, category) => {
      const index = budgets.findIndex((budget) => budget.category === category);
      if (index >= 0) budgets.splice(index, 1);
    },
    extractWithAi: async (message) => {
      ai.calls.push(message);
      return ai.result;
    },
    now: () => NOW,
  };

  return { deps, transactions, learned, budgets, failures, ai };
}
