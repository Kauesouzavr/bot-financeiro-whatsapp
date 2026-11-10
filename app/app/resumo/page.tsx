import type { Metadata } from "next";
import { SummaryView } from "@/channels/app/summary-view";
import { parseMonthParam } from "@/core/date/month";
import { getSaoPauloParts } from "@/core/date/sao-paulo";
import { summarizeMonth } from "@/core/summary/summarize-month";
import { requireAppUser } from "@/services/auth/current-user";
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

  const transactions = await getMonthStatement(user.id, month.year, month.month);

  return (
    <SummaryView month={month} current={current} now={now} summary={summarizeMonth(transactions)} />
  );
}
