import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decideAccess } from "@/core/auth/access";

// O "proxy" (antigo middleware) roda antes de cada página do app. Faz duas coisas:
// 1) renova a sessão do Supabase (o token expira e precisa ser trocado por um novo cookie);
// 2) manda quem não entrou para /entrar e quem já entrou de /entrar para /app.
// É uma checagem rápida, baseada no cookie. A checagem de verdade fica em requireAppUser().
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return response;

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Chamar isto logo no começo é o que faz o Supabase renovar o token e gravar o cookie novo.
  const { data } = await supabase.auth.getClaims();
  const decision = decideAccess(request.nextUrl.pathname, Boolean(data?.claims));

  if (decision === "allow") return response;

  const target = decision === "redirect-to-login" ? "/entrar" : "/app";
  const redirect = NextResponse.redirect(new URL(target, request.url));
  // Mantém os cookies renovados também no redirecionamento.
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: ["/app/:path*", "/entrar"],
};
