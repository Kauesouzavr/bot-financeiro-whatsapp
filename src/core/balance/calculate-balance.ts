import type { TransactionType } from "../types";

export interface BalanceTransaction {
  type: TransactionType;
  amountCents: number;
}

export interface BalanceSummary {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
}

export function calculateBalance(transactions: BalanceTransaction[]): BalanceSummary {
  let incomeCents = 0;
  let expenseCents = 0;

  for (const transaction of transactions) {
    if (transaction.type === "income") {
      incomeCents += transaction.amountCents;
    } else {
      expenseCents += transaction.amountCents;
    }
  }

  return { incomeCents, expenseCents, balanceCents: incomeCents - expenseCents };
}
