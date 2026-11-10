import { calculateBalance, type BalanceSummary } from "../balance/calculate-balance";
import type { TransactionType } from "../types";

// Transação como aparece no extrato. É a StoredTransaction do núcleo, sem depender dela
// (o resumo só lê, nunca corrige nem apaga).
export interface StatementTransaction {
  id: string;
  type: TransactionType;
  amountCents: number;
  description: string | null;
  category: string;
  occurredOn: string; // "YYYY-MM-DD"
}

export interface CategoryTotal {
  category: string;
  totalCents: number;
  // Inteiro de 0 a 100. Zero só quando a categoria é menos de 0,5% do total (o valor em si nunca é zero).
  percent: number;
}

export interface DayGroup {
  date: string; // "YYYY-MM-DD"
  transactions: StatementTransaction[];
}

export interface MonthSummary {
  balance: BalanceSummary;
  expensesByCategory: CategoryTotal[];
  incomesByCategory: CategoryTotal[];
  days: DayGroup[];
}

// Soma por categoria, da maior para a menor. Empate de valor desempata pelo nome, pra ordem nunca mudar sozinha.
function totalsByCategory(
  transactions: StatementTransaction[],
  type: TransactionType,
): CategoryTotal[] {
  const totals = new Map<string, number>();
  let grandTotal = 0;

  for (const transaction of transactions) {
    if (transaction.type !== type) continue;
    totals.set(
      transaction.category,
      (totals.get(transaction.category) ?? 0) + transaction.amountCents,
    );
    grandTotal += transaction.amountCents;
  }

  return [...totals.entries()]
    .map(([category, totalCents]) => ({
      category,
      totalCents,
      percent: Math.round((totalCents * 100) / grandTotal),
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.category.localeCompare(b.category, "pt-BR"));
}

// Dias do mais recente para o mais antigo. Dentro do dia, mantém a ordem que veio (o banco já manda
// a mais nova primeiro).
function groupByDay(transactions: StatementTransaction[]): DayGroup[] {
  const byDate = new Map<string, StatementTransaction[]>();

  for (const transaction of transactions) {
    const group = byDate.get(transaction.occurredOn);
    if (group) group.push(transaction);
    else byDate.set(transaction.occurredOn, [transaction]);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, dayTransactions]) => ({ date, transactions: dayTransactions }));
}

export function summarizeMonth(transactions: StatementTransaction[]): MonthSummary {
  return {
    balance: calculateBalance(transactions),
    expensesByCategory: totalsByCategory(transactions, "expense"),
    incomesByCategory: totalsByCategory(transactions, "income"),
    days: groupByDay(transactions),
  };
}
