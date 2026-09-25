"use server";

import { handleMessage } from "@/core/handle-message";

// Usuário fixo criado pela migration 0007, só para o simulador local.
const SIMULATOR_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function sendSimulatorMessage(content: string): Promise<string> {
  const trimmed = content.trim();
  if (!trimmed) return "";

  const replies = await handleMessage({
    userId: SIMULATOR_USER_ID,
    kind: "text",
    content: trimmed,
    source: "simulator",
  });

  return replies.map((reply) => reply.text).join("\n\n");
}
