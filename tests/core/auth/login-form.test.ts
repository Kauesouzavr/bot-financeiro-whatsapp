import { describe, expect, it } from "vitest";
import { parseLoginForm } from "@/core/auth/login-form";

function form(fields: Record<string, string | File>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("parseLoginForm", () => {
  it("lê e-mail e senha válidos", () => {
    expect(parseLoginForm(form({ email: "pessoa@exemplo.com", password: "segredo" }))).toEqual({
      email: "pessoa@exemplo.com",
      password: "segredo",
    });
  });

  it("apara espaços e põe o e-mail em minúsculas, mas não mexe na senha", () => {
    const result = parseLoginForm(form({ email: "  Pessoa@Exemplo.COM ", password: " Se gredo " }));
    expect(result).toEqual({ email: "pessoa@exemplo.com", password: " Se gredo " });
  });

  it.each([
    ["e-mail sem @", { email: "pessoa", password: "x" }],
    ["e-mail vazio", { email: "", password: "x" }],
    ["senha vazia", { email: "pessoa@exemplo.com", password: "" }],
    ["campos faltando", { email: "pessoa@exemplo.com" }],
    ["senha gigante", { email: "pessoa@exemplo.com", password: "a".repeat(201) }],
    ["e-mail gigante", { email: `${"a".repeat(250)}@exemplo.com`, password: "x" }],
  ])("devolve null para %s", (_label, fields) => {
    expect(parseLoginForm(form(fields))).toBeNull();
  });

  it("devolve null quando o campo vem como arquivo, não como texto", () => {
    const data = form({ password: "x" });
    data.set("email", new File(["a"], "a.txt"));
    expect(parseLoginForm(data)).toBeNull();
  });
});
