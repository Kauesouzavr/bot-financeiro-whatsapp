import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "Supabase: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar configurados.",
  );
}

// Cliente com a chave secreta: ignora RLS, só pode ser importado em código de servidor.
// O pacote "server-only" quebra o build se algum arquivo de cliente tentar importar isso.
export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false },
});
