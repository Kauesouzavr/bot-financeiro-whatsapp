"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sniffAudioMimeType, sniffReceiptMimeType } from "@/core/ai/file-type";
import { RECEIPT_MAX_BYTES, RECEIPT_MESSAGES } from "@/core/ai/receipt";
import { VOICE_MAX_BYTES, VOICE_MESSAGES } from "@/core/ai/voice";
import type { PendingResult, ReceiptResult, SendResult } from "@/core/chat/chat-service";
import { requireAppUser } from "@/services/auth/current-user";
import { createAuthClient } from "@/services/auth/server-client";
import { chatService } from "./chat";

// Server Actions são endpoints que qualquer um pode chamar direto, sem passar pela tela:
// por isso TODAS começam conferindo o usuário no servidor (requireAppUser).

export async function sendAppMessage(text: string): Promise<SendResult> {
  const user = await requireAppUser();
  return chatService.sendMessage(user.id, String(text ?? ""));
}

// Recebe o comprovante (foto ou PDF), lê, e guarda como pendência. Não grava transação nenhuma.
export async function sendReceiptAction(formData: FormData): Promise<ReceiptResult> {
  const user = await requireAppUser();

  const file = formData.get("file");
  // Confere o tamanho antes de ler o arquivo inteiro pra memória.
  if (!(file instanceof File) || file.size === 0 || file.size > RECEIPT_MAX_BYTES) {
    return { ok: false, error: RECEIPT_MESSAGES.invalidFile };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // O tipo vem dos primeiros bytes do arquivo, não do que o navegador declarou.
  const mimeType = sniffReceiptMimeType(bytes);
  if (!mimeType) return { ok: false, error: RECEIPT_MESSAGES.invalidFile };

  return chatService.sendReceipt(user.id, { mimeType, bytes });
}

// Recebe a gravação de voz, transcreve e segue o mesmo fluxo do texto. O áudio nunca é guardado.
export async function sendVoiceAction(formData: FormData): Promise<SendResult> {
  const user = await requireAppUser();

  const file = formData.get("file");
  // Confere o tamanho antes de ler o arquivo inteiro pra memória.
  if (!(file instanceof File) || file.size === 0 || file.size > VOICE_MAX_BYTES) {
    return { ok: false, error: VOICE_MESSAGES.invalidFile };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // O tipo vem dos primeiros bytes do arquivo, não do que o navegador declarou.
  const mimeType = sniffAudioMimeType(bytes);
  if (!mimeType) return { ok: false, error: VOICE_MESSAGES.invalidFile };

  return chatService.sendVoice(user.id, { mimeType, bytes });
}

const pendingIdSchema = z.uuid();

export async function confirmReceiptAction(pendingId: string): Promise<PendingResult> {
  const user = await requireAppUser();
  const id = pendingIdSchema.safeParse(pendingId);
  if (!id.success) return { ok: false, error: RECEIPT_MESSAGES.alreadyHandled };
  return chatService.confirmPending(user.id, id.data);
}

export async function cancelReceiptAction(pendingId: string): Promise<PendingResult> {
  const user = await requireAppUser();
  const id = pendingIdSchema.safeParse(pendingId);
  if (!id.success) return { ok: false, error: RECEIPT_MESSAGES.alreadyHandled };
  return chatService.cancelPending(user.id, id.data);
}

export async function clearAppChat(): Promise<void> {
  const user = await requireAppUser();
  await chatService.clear(user.id);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
