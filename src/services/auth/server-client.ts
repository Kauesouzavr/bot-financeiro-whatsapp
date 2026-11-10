import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente do Supabase Auth para o servidor, com a chave PÚBLICA (publishable): ele só cuida do
// login e lê/escreve a sessão nos cookies. O acesso aos dados continua pela chave secreta
// (supabase/admin.ts), sempre depois de conferir quem é o usuário.
export async function createAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase Auth: NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY precisam estar configurados.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components não podem escrever cookie. Sem problema: o proxy.ts renova
          // a sessão a cada requisição, e as Server Actions escrevem normalmente.
        }
      },
    },
  });
}
