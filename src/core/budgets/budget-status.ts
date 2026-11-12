import type { BalanceTransaction } from "../balance/calculate-balance";

// A partir deste percentual do limite o orçamento entra em "atenção".
export const BUDGET_WARNING_PERCENT = 80;

// Teto aceito para um orçamento (R$ 1.000.000,00): cabe folgado no inteiro do banco e barra digitação errada.
export const MAX_BUDGET_CENTS = 100_000_000;

export interface Budget {
  category: string;
  limitCents: number;
}

// Transação do mês com a categoria: o que falta ao saldo para também comparar gasto com orçamento.
export interface CategorizedTransaction extends BalanceTransaction {
  category: string;
}

// "ok" até 80% do limite, "warning" de 80% até o limite (inclusive), "exceeded" quando passa dele.
export type BudgetState = "ok" | "warning" | "exceeded";

export interface BudgetStatus {
  category: string;
  limitCents: number;
  spentCents: number;
  // Quanto ainda cabe no limite (zero quando já acabou ou passou).
  remainingCents: number;
  // Quanto passou do limite (zero enquanto está dentro).
  overCents: number;
  // Inteiro arredondado para baixo: só mostra 100% quando o limite foi mesmo atingido. Passa de 100 ao estourar.
  percent: number;
  state: BudgetState;
}

// Compara em centavos inteiros (nunca com divisão decimal), então 80% exatos já contam como atenção.
function budgetState(spentCents: number, limitCents: number): BudgetState {
  if (spentCents > limitCents) return "exceeded";
  if (spentCents * 100 >= limitCents * BUDGET_WARNING_PERCENT) return "warning";
  return "ok";
}

// Só gastos entram na conta. Devolve os mais apertados primeiro; empate desempata pelo nome,
// pra ordem nunca mudar sozinha.
export function calculateBudgetStatuses(
  budgets: Budget[],
  transactions: CategorizedTransaction[],
): BudgetStatus[] {
  const spentByCategory = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== "expense") continue;
    spentByCategory.set(
      transaction.category,
      (spentByCategory.get(transaction.category) ?? 0) + transaction.amountCents,
    );
  }

  return budgets
    .filter((budget) => budget.limitCents > 0)
    .map((budget) => {
      const spentCents = spentByCategory.get(budget.category) ?? 0;
      return {
        category: budget.category,
        limitCents: budget.limitCents,
        spentCents,
        remainingCents: Math.max(budget.limitCents - spentCents, 0),
        overCents: Math.max(spentCents - budget.limitCents, 0),
        percent: Math.floor((spentCents * 100) / budget.limitCents),
        state: budgetState(spentCents, budget.limitCents),
      };
    })
    .sort((a, b) => b.percent - a.percent || a.category.localeCompare(b.category, "pt-BR"));
}
