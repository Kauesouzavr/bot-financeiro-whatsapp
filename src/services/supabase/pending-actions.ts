import "server-only";
import { pendingTransactionSchema } from "@/core/ai/receipt";
import type { PendingReceipt } from "@/core/chat/chat-service";
import type { ParsedTransaction } from "@/core/types";
import { supabaseAdmin } from "./admin";

const KIND = "confirm_image";

interface PendingRow {
  id: string;
  payload: unknown;
  expires_at: string;
}

// O payload é conferido de novo ao ler: nunca confiamos cegamente num JSON guardado no banco.
function toPending(row: PendingRow): PendingReceipt | null {
  const parsed = pendingTransactionSchema.safeParse(row.payload);
  if (!parsed.success) return null;
  return { id: row.id, transaction: parsed.data, expiresAt: new Date(row.expires_at) };
}

// A chave secreta ignora RLS, então toda consulta filtra por user_id: é isso que impede
// uma pessoa de ver ou confirmar a pendência da outra.

// Cada pessoa tem no máximo uma pendência: guardar uma nova apaga a anterior.
export async function replacePending(
  userId: string,
  transaction: ParsedTransaction,
  expiresAt: Date,
): Promise<PendingReceipt> {
  await clearPending(userId);

  const { data, error } = await supabaseAdmin
    .from("pending_actions")
    .insert({
      user_id: userId,
      kind: KIND,
      payload: transaction,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, payload, expires_at")
    .single();
  if (error) throw error;

  const pending = toPending(data);
  if (!pending) throw new Error("pendência inválida logo após guardar");
  return pending;
}

export async function getPending(userId: string, now: Date): Promise<PendingReceipt | null> {
  const { data, error } = await supabaseAdmin
    .from("pending_actions")
    .select("id, payload, expires_at")
    .eq("user_id", userId)
    .eq("kind", KIND)
    .gt("expires_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toPending(data) : null;
}

// Apaga e devolve a pendência numa única operação do banco: se duas confirmações chegarem ao
// mesmo tempo (toque duplo), só uma encontra a linha, então a transação nunca é gravada duas vezes.
export async function takePending(
  userId: string,
  pendingId: string,
  now: Date,
): Promise<PendingReceipt | null> {
  const { data, error } = await supabaseAdmin
    .from("pending_actions")
    .delete()
    .eq("id", pendingId)
    .eq("user_id", userId)
    .eq("kind", KIND)
    .gt("expires_at", now.toISOString())
    .select("id, payload, expires_at");

  if (error) throw error;
  const row = data?.[0];
  return row ? toPending(row) : null;
}

export async function clearPending(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("pending_actions")
    .delete()
    .eq("user_id", userId)
    .eq("kind", KIND);
  if (error) throw error;
}
