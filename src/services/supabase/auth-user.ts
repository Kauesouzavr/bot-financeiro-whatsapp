import "server-only";
import { supabaseAdmin } from "./admin";

export interface AppUser {
  id: string;
  name: string | null;
}

// Acha o usuário do bot que está ligado a esse login (coluna users.auth_user_id).
// Só devolve se estiver ativo: desativar o usuário também tranca o app.
export async function findActiveUserByAuthId(authUserId: string): Promise<AppUser | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, name")
    .eq("auth_user_id", authUserId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
