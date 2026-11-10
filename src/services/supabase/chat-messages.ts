import "server-only";
import {
  CHAT_HISTORY_LIMIT,
  type ChatMessage,
  type NewChatMessage,
} from "@/core/chat/chat-service";
import { supabaseAdmin } from "./admin";

// A chave secreta ignora RLS, então toda consulta filtra por user_id: é isso que impede
// uma pessoa de ler ou apagar a conversa da outra.
export async function listChatMessages(userId: string, limit: number): Promise<ChatMessage[]> {
  const { data, error } = await supabaseAdmin
    .from("chat_messages")
    .select("id, role, text")
    .eq("user_id", userId)
    .order("seq", { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Veio da mais nova pra mais velha: inverte pra ficar na ordem da conversa.
  return (data ?? []).reverse().map((row) => ({
    id: row.id,
    role: row.role as ChatMessage["role"],
    text: row.text,
  }));
}

export async function appendChatMessages(
  userId: string,
  messages: NewChatMessage[],
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("chat_messages")
    .insert(messages.map((message) => ({ user_id: userId, ...message })));
  if (error) throw error;

  await trimChatMessages(userId);
}

// Mantém só as últimas CHAT_HISTORY_LIMIT mensagens: apaga o que passou do limite.
async function trimChatMessages(userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("chat_messages")
    .select("id")
    .eq("user_id", userId)
    .order("seq", { ascending: false })
    .range(CHAT_HISTORY_LIMIT, CHAT_HISTORY_LIMIT + 499);
  if (error) throw error;
  if (!data || data.length === 0) return;

  const { error: deleteError } = await supabaseAdmin
    .from("chat_messages")
    .delete()
    .eq("user_id", userId)
    .in(
      "id",
      data.map((row) => row.id),
    );
  if (deleteError) throw deleteError;
}

export async function clearChatMessages(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("chat_messages").delete().eq("user_id", userId);
  if (error) throw error;
}
