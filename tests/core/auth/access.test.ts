import { describe, expect, it } from "vitest";
import { decideAccess } from "@/core/auth/access";

describe("decideAccess", () => {
  it("manda para o login quem não entrou e tenta abrir o app", () => {
    expect(decideAccess("/app", false)).toBe("redirect-to-login");
    expect(decideAccess("/app/", false)).toBe("redirect-to-login");
    expect(decideAccess("/app/qualquer/coisa", false)).toBe("redirect-to-login");
  });

  it("deixa entrar no app quem tem sessão", () => {
    expect(decideAccess("/app", true)).toBe("allow");
    expect(decideAccess("/app/algo", true)).toBe("allow");
  });

  it("deixa abrir a tela de login quem ainda não entrou", () => {
    expect(decideAccess("/entrar", false)).toBe("allow");
  });

  it("manda para o app quem já entrou e abre o login", () => {
    expect(decideAccess("/entrar", true)).toBe("redirect-to-app");
  });

  it("não mexe nas outras rotas", () => {
    expect(decideAccess("/", false)).toBe("allow");
    expect(decideAccess("/simulador", false)).toBe("allow");
    expect(decideAccess("/api/webhook/whatsapp", false)).toBe("allow");
  });

  it("não confunde rotas que só começam com 'app' (ex.: /aplicativo, /application)", () => {
    expect(decideAccess("/aplicativo", false)).toBe("allow");
    expect(decideAccess("/application", false)).toBe("allow");
  });
});
