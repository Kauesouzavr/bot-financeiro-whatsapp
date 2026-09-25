import type { BalanceTransaction } from "@/core/balance/calculate-balance";
import type { ParsedTransaction, TransactionSource } from "@/core/types";
import { supabaseAdmin } from "./admin";

export async function insertTransactions(
  userId: string,
  transactions: ParsedTransaction[],
  source: TransactionSource,
): Promise<void> {
  const rows = transactions.map((transaction) => ({
    user_id: userId,
    type: transaction.type,
    amount_cents: transaction.amountCents,
    description: transaction.description,
    category: transaction.category,
    occurred_on: transaction.occurredOn,
    source,
  }));

  const { error } = await supabaseAdmin.from("transactions").insert(rows);
  if (error) throw error;
}

export async function getMonthTransactions(
  userId: string,
  year: number,
  month: number,
): Promise<BalanceTransaction[]> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${year}-${pad(month)}-01`;
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const end = `${next.year}-${pad(next.month)}-01`;

  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("type, amount_cents")
    .eq("user_id", userId)
    .gte("occurred_on", start)
    .lt("occurred_on", end);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    type: row.type as BalanceTransaction["type"],
    amountCents: row.amount_cents,
  }));
}
