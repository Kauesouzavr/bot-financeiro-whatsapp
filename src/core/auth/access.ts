export type AccessDecision = "allow" | "redirect-to-login" | "redirect-to-app";

// Decide, só pela rota e por haver sessão ou não, o que o proxy faz com a requisição.
// É só uma checagem otimista (rápida, baseada no cookie): a checagem de verdade, que confere
// o usuário no servidor de autenticação, roda em cada página e em cada ação (requireAppUser).
export function decideAccess(pathname: string, isLoggedIn: boolean): AccessDecision {
  const isAppRoute = pathname === "/app" || pathname.startsWith("/app/");

  if (isAppRoute && !isLoggedIn) return "redirect-to-login";
  if (pathname === "/entrar" && isLoggedIn) return "redirect-to-app";
  return "allow";
}
