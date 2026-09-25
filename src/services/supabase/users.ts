import "server-only";
import { supabaseAdmin } from "./admin";

export interface AuthorizedUser {
  id: string;
  phone: string;
}

// `candidatePhones` já vem calculado por quem chama (ex.: as duas formas do
// wa_id, com e sem o nono dígito) — este serviço só faz a consulta.
export async function findActiveUserByPhone(
  candidatePhones: string[],
): Promise<AuthorizedUser | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, phone")
    .in("phone", candidatePhones)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
