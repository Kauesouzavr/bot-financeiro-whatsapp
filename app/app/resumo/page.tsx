import type { Metadata } from "next";
import { SummaryView } from "@/channels/app/summary-view";
import { calculateBudgetStatuses, type Budget } from "@/core/budgets/budget-status";
import { parseMonthParam } from "@/core/date/month";
import { getSaoPauloParts } from "@/core/date/sao-paulo";
import { summarizeMonth } from "@/core/summary/summarize-month";
import { requireAppUser } from "@/services/auth/current-user";
import { getBudgets } from "@/services/supabase/budgets";
import { getMonthStatement } from "@/services/supabase/transactions";

export const metadata: Metadata = {
  title: "Resumo | Bot Financeiro",
  robots: { index: false, follow: false },
};

export default async function SummaryPage({ searchParams }: PageProps<"/app/resumo">) {
  // Sem usuário válido, esta linha redireciona e o resto nunca roda.
  const user = await requireAppUser();

  const now = new Date();
  const current = getSaoPauloParts(now);
  const { mes } = await searchParams;
  const month = parseMonthParam(typeof mes === "string" ? mes : undefined, current);

  const [transactions, budgets] = await Promise.all([
    getMonthStatement(user.id, month.year, month.month),
    loadBudgetsOrNone(user.id),
  ]);

  return (
    <SummaryView
      month={month}
      current={current}
      now={now}
      summary={summarizeMonth(transactions)}
      budgets={calculateBudgetStatuses(budgets, transactions)}
    />
  );
}

// Os orçamentos são um extra da tela: se a leitura falhar, o resumo aparece do mesmo jeito, sem o bloco.
// Só o tipo do erro vai pro log, nunca valores.
async function loadBudgetsOrNone(userId: string): Promise<Budget[]> {
  try {
    return await getBudgets(userId);
  } catch (error) {
    console.error(
      "Erro ao ler os orçamentos:",
      error instanceof Error ? error.name : "desconhecido",
    );
    return [];
  }
}
