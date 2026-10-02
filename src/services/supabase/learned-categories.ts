import "server-only";
import type { LearnedCategories } from "@/core/categories";
import { supabaseAdmin } from "./admin";

export async function getLearnedCategories(userId: string): Promise<LearnedCategories> {
  const { data, error } = await supabaseAdmin
    .from("learned_categories")
    .select("term, category")
    .eq("user_id", userId);

  if (error) throw error;

  return Object.fromEntries((data ?? []).map((row) => [row.term, row.category]));
}

// Se o termo já existe pra esse usuário, só troca a categoria (upsert pela chave user_id + term).
export async function saveLearnedCategory(
  userId: string,
  term: string,
  category: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("learned_categories")
    .upsert({ user_id: userId, term, category }, { onConflict: "user_id,term" });

  if (error) throw error;
}
