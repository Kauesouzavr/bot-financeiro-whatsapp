import type { BalanceSummary } from "../balance/calculate-balance";
import { categoriesFor } from "../categories";
import type { ParsedTransaction, TransactionType } from "../types";

export function formatCurrency(cents: number): string {
  const value = cents / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(value)
    .replace(/ /g, " ");
}

// "R$ 45,00 em Delivery (ifood)": a descrição da transação, reaproveitada nas respostas.
function describeTransaction(transaction: ParsedTransaction): string {
  const amount = formatCurrency(transaction.amountCents);
  const description = transaction.description ? ` (${transaction.description})` : "";
  return `${amount} em ${transaction.category}${description}`;
}

export function formatConfirmation(transaction: ParsedTransaction): string {
  return `✅ ${describeTransaction(transaction)}`;
}

export function formatDeleted(transaction: ParsedTransaction): string {
  return `🗑️ Apaguei: ${describeTransaction(transaction)}`;
}

// `transaction` já vem com a categoria nova. `learnedTerm` é o termo que o bot vai lembrar (se houver).
export function formatCategoryChanged(
  transaction: ParsedTransaction,
  learnedTerm: string | null,
): string {
  const amount = formatCurrency(transaction.amountCents);
  const description = transaction.description ? ` (${transaction.description})` : "";
  const lines = [`✏️ Pronto! ${amount}${description} agora é ${transaction.category}.`];
  if (learnedTerm) {
    lines.push(`Da próxima vez, "${learnedTerm}" já entra como ${transaction.category}.`);
  }
  return lines.join("\n");
}

export function formatNoTransactions(): string {
  return 'Você ainda não tem nenhum registro por aqui. Manda algo como "gastei 45 no ifood" pra começar.';
}

export function formatUnknownCategory(rawCategory: string, type: TransactionType): string {
  const list = categoriesFor(type).join(", ");
  const kind = type === "income" ? "entradas" : "gastos";
  return `Não conheço a categoria "${rawCategory}". Pra ${kind} eu tenho: ${list}.`;
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

export function formatQuotaWarning(): string {
  return "⚠️ Quase no limite de respostas grátis do mês. Continuo registrando tudo, mas posso ficar em modo silencioso em breve.";
}
