import { formatMonthParam, type MonthRef } from "../date/month";
import type { ParsedTransaction } from "../types";
import { calculateBudgetStatuses, type Budget, type CategorizedTransaction } from "./budget-status";
import { formatBudgetAlert } from "./format-budget";

interface BudgetAlertInput {
  // Lê os orçamentos só se for preciso (gasto novo numa categoria do mês).
  loadBudgets: () => Promise<Budget[]>;
  // Transações do mês, já com as que acabaram de ser gravadas.
  monthTransactions: CategorizedTransaction[];
  // O que acabou de ser gravado: só estas categorias podem gerar aviso.
  saved: ParsedTransaction[];
  month: MonthRef;
}

// Linhas de aviso para juntar à resposta de um gasto: uma por categoria com orçamento em atenção ou estourado.
// O orçamento é um extra: se a leitura dele falhar, o registro do gasto já foi feito e não pode ser
// perturbado. Por isso o erro é engolido (só o tipo vai pro log, nunca valores).
export async function getBudgetAlertLines(input: BudgetAlertInput): Promise<string[]> {
  const monthKey = formatMonthParam(input.month);

  // Entrada, ou gasto de outro mês ("paguei a luz dia 10" pode cair no mês passado), não mexe no orçamento deste mês.
  const touched = new Set(
    input.saved
      .filter(
        (transaction) =>
          transaction.type === "expense" && transaction.occurredOn.startsWith(monthKey),
      )
      .map((transaction) => transaction.category),
  );
  if (touched.size === 0) return [];

  try {
    const budgets = (await input.loadBudgets()).filter((budget) => touched.has(budget.category));
    return calculateBudgetStatuses(budgets, input.monthTransactions)
      .map(formatBudgetAlert)
      .filter((line): line is string => line !== null);
  } catch (error) {
    console.error(
      "Erro ao ler os orçamentos:",
      error instanceof Error ? error.name : "desconhecido",
    );
    return [];
  }
}
