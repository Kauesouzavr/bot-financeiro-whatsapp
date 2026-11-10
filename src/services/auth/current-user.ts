import "server-only";
import { redirect } from "next/navigation";
import { findActiveUserByAuthId, type AppUser } from "../supabase/auth-user";
import { createAuthClient } from "./server-client";

export type CurrentUser =
  { status: "anonymous" } | { status: "no-access" } | { status: "ok"; user: AppUser };

// A checagem de verdade: getUser() pergunta ao servidor do Supabase se o token ainda vale
// (o proxy só olha o cookie, o que é rápido mas não prova nada). "no-access" = tem login, mas
// ninguém ligou esse login a um usuário ativo do bot (users.auth_user_id).
export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { status: "anonymous" };

  const appUser = await findActiveUserByAuthId(data.user.id);
  return appUser ? { status: "ok", user: appUser } : { status: "no-access" };
}

// Usada no começo de toda página e de toda Server Action do app: sem usuário válido, não passa.
export async function requireAppUser(): Promise<AppUser> {
  const current = await getCurrentUser();
  if (current.status === "anonymous") redirect("/entrar");
  if (current.status === "no-access") redirect("/sem-acesso");
  return current.user;
}
