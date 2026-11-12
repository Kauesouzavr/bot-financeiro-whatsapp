import type { Budget } from "@/core/budgets/budget-status";
import { supabaseAdmin } from "./admin";

// A chave secreta ignora RLS, então toda consulta abaixo filtra por user_id:
// é isso que impede um usuário de ver ou mexer no orçamento de outro.
export async function getBudgets(userId: string): Promise<Budget[]> {
  const { data, error } = await supabaseAdmin
    .from("budgets")
    .select("category, limit_cents")
    .eq("user_id", userId);

  if (error) throw error;

  return (data ?? []).map((row) => ({ category: row.category, limitCents: row.limit_cents }));
}

// Um limite por usuário e categoria: definir de novo troca o valor em vez de criar outro.
export async function setBudget(
  userId: string,
  category: string,
  limitCents: number,
): Promise<void> {
  const { error } = await supabaseAdmin.from("budgets").upsert(
    {
      user_id: userId,
      category,
      limit_cents: limitCents,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,category" },
  );

  if (error) throw error;
}

export async function removeBudget(userId: string, category: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("budgets")
    .delete()
    .eq("user_id", userId)
    .eq("category", category);

  if (error) throw error;
}
