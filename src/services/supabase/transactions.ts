import type { CategorizedTransaction } from "@/core/budgets/budget-status";
import { monthRange } from "@/core/date/month";
import type { StatementTransaction } from "@/core/summary/summarize-month";
import type { ParsedTransaction, StoredTransaction, TransactionSource } from "@/core/types";
import { supabaseAdmin } from "./admin";

// O Supabase devolve no máximo 1.000 linhas por consulta. Para uma pessoa, passa de longe do que ela
// registra num mês, mas o limite fica explícito aqui para o resumo e o extrato nunca discordarem.
const MONTH_STATEMENT_LIMIT = 1000;

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
): Promise<CategorizedTransaction[]> {
  const { start, end } = monthRange({ year, month });

  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("type, amount_cents, category")
    .eq("user_id", userId)
    .gte("occurred_on", start)
    .lt("occurred_on", end);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    type: row.type as CategorizedTransaction["type"],
    amountCents: row.amount_cents,
    category: row.category,
  }));
}

// Todas as transações do mês para o resumo e o extrato: a mais recente primeiro (data e, no mesmo dia,
// ordem de inserção). Só leitura, sempre filtrada por user_id (a chave secreta ignora RLS).
export async function getMonthStatement(
  userId: string,
  year: number,
  month: number,
): Promise<StatementTransaction[]> {
  const { start, end } = monthRange({ year, month });

  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("id, type, amount_cents, description, category, occurred_on")
    .eq("user_id", userId)
    .gte("occurred_on", start)
    .lt("occurred_on", end)
    .order("occurred_on", { ascending: false })
    .order("seq", { ascending: false })
    .limit(MONTH_STATEMENT_LIMIT);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type as StatementTransaction["type"],
    amountCents: row.amount_cents,
    description: row.description,
    category: row.category,
    occurredOn: row.occurred_on,
  }));
}
