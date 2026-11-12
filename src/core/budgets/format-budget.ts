import type { MonthRef } from "../date/month";
import { formatCurrency } from "../replies/format-reply";
import { formatMonthTitle } from "../summary/format-summary";
import { MAX_BUDGET_CENTS, type BudgetStatus } from "./budget-status";

function progress(status: BudgetStatus): string {
  return `${formatCurrency(status.spentCents)} de ${formatCurrency(status.limitCents)}`;
}

// Linha de aviso que vai junto com a confirmação do gasto. Só existe quando o orçamento pede atenção:
// dentro do limite o bot não fala nada, pra não virar ruído.
export function formatBudgetAlert(status: BudgetStatus): string | null {
  if (status.state === "ok") return null;

  if (status.state === "exceeded") {
    return `🚨 ${status.category}: ${progress(status)} · passou ${formatCurrency(status.overCents)}`;
  }
  return `⚠️ ${status.category}: ${progress(status)} (${status.percent}%)`;
}

// Legenda curta sob a barra do orçamento no Resumo. O estado vai por escrito (emoji e palavras),
// nunca só pela cor da barra.
export function formatBudgetNote(status: BudgetStatus): string {
  if (status.state === "exceeded") {
    return `🚨 ${status.percent}% · passou ${formatCurrency(status.overCents)}`;
  }
  if (status.remainingCents === 0) return `⚠️ ${status.percent}% · limite atingido`;

  const note = `${status.percent}% · faltam ${formatCurrency(status.remainingCents)}`;
  return status.state === "warning" ? `⚠️ ${note}` : note;
}

// Resposta a "orçamento delivery 300": confirma o limite e já mostra como o mês está.
export function formatBudgetSet(status: BudgetStatus): string {
  const lines = [
    `🎯 Orçamento de ${status.category}: ${formatCurrency(status.limitCents)} por mês.`,
    `Neste mês: ${formatCurrency(status.spentCents)} (${status.percent}%).`,
  ];

  if (status.state === "exceeded") {
    lines.push(`🚨 Já passou ${formatCurrency(status.overCents)}.`);
  } else if (status.state === "warning") {
    lines.push("⚠️ Já está perto do limite.");
  }

  return lines.join("\n");
}

export function formatBudgetList(statuses: BudgetStatus[], month: MonthRef): string {
  if (statuses.length === 0) return formatNoBudgets();

  const rows = statuses.map(
    (status) =>
      `• ${formatBudgetAlert(status) ?? `${status.category}: ${progress(status)} (${status.percent}%)`}`,
  );
  return [`🎯 Orçamentos de ${formatMonthTitle(month)}:`, ...rows].join("\n");
}

export function formatNoBudgets(): string {
  return 'Você ainda não definiu nenhum orçamento. Manda algo como "orçamento delivery 300".';
}

export function formatBudgetRemoved(category: string): string {
  return `🗑️ Orçamento de ${category} removido.`;
}

export function formatBudgetNotFound(category: string): string {
  return `Você não tem orçamento em ${category}.`;
}

export function formatInvalidBudgetAmount(): string {
  return 'O valor do orçamento precisa ser maior que zero. Exemplo: "orçamento delivery 300".';
}

export function formatBudgetAmountTooHigh(): string {
  return `Esse valor é alto demais. O máximo por categoria é ${formatCurrency(MAX_BUDGET_CENTS)}.`;
}
