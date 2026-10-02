import type { BalanceTransaction } from "@/core/balance/calculate-balance";
import type { ParsedTransaction, StoredTransaction, TransactionSource } from "@/core/types";
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

// A chave secreta ignora RLS, então toda consulta abaixo filtra por user_id:
// é isso que impede um usuário de mexer na transação de outro.
export async function getLastTransaction(userId: string): Promise<StoredTransaction | null> {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("id, type, amount_cents, description, category, occurred_on")
    .eq("user_id", userId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    type: data.type as StoredTransaction["type"],
    amountCents: data.amount_cents,
    description: data.description,
    category: data.category,
    occurredOn: data.occurred_on,
  };
}

export async function updateTransactionCategory(
  userId: string,
  transactionId: string,
  category: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("transactions")
    .update({ category })
    .eq("id", transactionId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function deleteTransaction(userId: string, transactionId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", userId);

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
