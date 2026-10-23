"use server";

import { handleMessage } from "@/core/handle-message";
import { isSimulatorEnabled, SIMULATOR_MAX_LENGTH } from "./enabled";

// Usuário fixo criado pela migration 0007, só para o simulador local.
const SIMULATOR_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function sendSimulatorMessage(content: string): Promise<string> {
  // A página já some em produção, mas Server Actions são endpoints que podem
  // ser chamados direto. Por isso a mesma checagem roda aqui, no servidor.
  if (!isSimulatorEnabled()) {
    throw new Error("Simulador desativado neste ambiente.");
  }

  const trimmed = String(content ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.length > SIMULATOR_MAX_LENGTH) {
    return `Mensagem muito longa. Mande até ${SIMULATOR_MAX_LENGTH} caracteres.`;
  }

  const replies = await handleMessage({
    userId: SIMULATOR_USER_ID,
    kind: "text",
    content: trimmed,
    source: "simulator",
  });

  return replies.map((reply) => reply.text).join("\n\n");
}
