import "server-only";
import { supabaseAdmin } from "./admin";

export async function getMonthlyReplies(month: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("monthly_usage")
    .select("replies_sent")
    .eq("month", month)
    .maybeSingle();

  if (error) throw error;
  return data?.replies_sent ?? 0;
}

// `repliesSentBefore` é o valor já lido por quem chama (evita reconsultar).
export async function incrementMonthlyReplies(
  month: string,
  repliesSentBefore: number,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("monthly_usage")
    .upsert({ month, replies_sent: repliesSentBefore + 1 });

  if (error) throw error;
}
