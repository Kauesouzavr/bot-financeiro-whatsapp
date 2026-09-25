import "server-only";
import { supabaseAdmin } from "./admin";

const UNIQUE_VIOLATION = "23505";

// A Meta pode reenviar o mesmo evento de webhook. Tenta inserir o id da
// mensagem; se colidir com a chave única, já foi processada antes.
// Devolve true só na primeira vez (mensagem nova).
export async function markMessageProcessed(waMessageId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("processed_messages")
    .insert({ wa_message_id: waMessageId });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return false;
    throw error;
  }

  return true;
}
