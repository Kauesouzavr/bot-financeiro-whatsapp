import type { BalanceSummary } from "../balance/calculate-balance";
import type { ParsedTransaction } from "../types";

export function formatCurrency(cents: number): string {
  const value = cents / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(value)
    .replace(/ /g, " ");
}

export function formatConfirmation(transaction: ParsedTransaction): string {
  const amount = formatCurrency(transaction.amountCents);
  const description = transaction.description ? ` (${transaction.description})` : "";
  return `✅ ${amount} em ${transaction.category}${description}`;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function formatBalance(
  summary: BalanceSummary,
  month: { year: number; month: number },
): string {
  const monthName = capitalize(
    new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(
      new Date(Date.UTC(month.year, month.month - 1, 1)),
    ),
  );

  return `${monthName}: entrou ${formatCurrency(summary.incomeCents)} · saiu ${formatCurrency(summary.expenseCents)} · saldo ${formatCurrency(summary.balanceCents)}`;
}

export function formatUnrecognized(): string {
  return 'Não entendi essa mensagem 🤔\nTenta assim: "gastei 45 no ifood" ou "recebi 1500 salário".';
}
