"use server";

import { redirect } from "next/navigation";
import { parseLoginForm } from "@/core/auth/login-form";
import { createAuthClient } from "@/services/auth/server-client";

export interface LoginState {
  error: string | null;
}

// Mensagem única para qualquer falha (campo inválido, e-mail que não existe, senha errada):
// não revela se o e-mail está cadastrado.
const GENERIC_ERROR = "E-mail ou senha incorretos.";

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const credentials = parseLoginForm(formData);
  if (!credentials) return { error: GENERIC_ERROR };

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) return { error: GENERIC_ERROR };

  redirect("/app");
}
