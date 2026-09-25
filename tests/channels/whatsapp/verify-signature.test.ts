import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidSignature } from "@/channels/whatsapp/verify-signature";

const APP_SECRET = "segredo-de-teste";

function sign(body: string, secret = APP_SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

describe("isValidSignature", () => {
  it("aceita uma assinatura válida", () => {
    const body = '{"hello":"world"}';
    expect(isValidSignature(body, sign(body), APP_SECRET)).toBe(true);
  });

  it("rejeita quando o corpo foi alterado", () => {
    const body = '{"hello":"world"}';
    const signature = sign(body);
    expect(isValidSignature('{"hello":"mundo"}', signature, APP_SECRET)).toBe(false);
  });

  it("rejeita quando o segredo está errado", () => {
    const body = '{"hello":"world"}';
    const signature = sign(body, "outro-segredo");
    expect(isValidSignature(body, signature, APP_SECRET)).toBe(false);
  });

  it("rejeita quando não há cabeçalho de assinatura", () => {
    expect(isValidSignature("{}", null, APP_SECRET)).toBe(false);
  });

  it("rejeita uma assinatura malformada sem lançar erro", () => {
    expect(isValidSignature("{}", "nao-e-um-hash-valido", APP_SECRET)).toBe(false);
  });
});
