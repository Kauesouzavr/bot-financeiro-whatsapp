"use server";

import { redirect } from "next/navigation";
import type { SendResult } from "@/core/chat/chat-service";
import { requireAppUser } from "@/services/auth/current-user";
import { createAuthClient } from "@/services/auth/server-client";
import { chatService } from "./chat";

// Server Actions são endpoints que qualquer um pode chamar direto, sem passar pela tela:
// por isso TODAS começam conferindo o usuário no servidor (requireAppUser).

export async function sendAppMessage(text: string): Promise<SendResult> {
  const user = await requireAppUser();
  return chatService.sendMessage(user.id, String(text ?? ""));
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
