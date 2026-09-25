import { describe, expect, it } from "vitest";
import { maskPhone, phoneVariants } from "@/channels/whatsapp/phone";

describe("phoneVariants", () => {
  it("gera a forma sem o nono dígito quando o wa_id chega com ele", () => {
    expect(phoneVariants("5511987654321")).toEqual(["5511987654321", "551187654321"]);
  });

  it("gera a forma com o nono dígito quando o wa_id chega sem ele", () => {
    expect(phoneVariants("551187654321")).toEqual(["551187654321", "5511987654321"]);
  });

  it("limpa caracteres não numéricos antes de comparar", () => {
    expect(phoneVariants("+55 11 98765-4321")).toEqual(["5511987654321", "551187654321"]);
  });

  it("devolve só o número original quando não reconhece o formato", () => {
    expect(phoneVariants("123")).toEqual(["123"]);
  });
});

describe("maskPhone", () => {
  it("mantém DDI+DDD e os últimos 4 dígitos, mascara o resto", () => {
    expect(maskPhone("5524999994137")).toBe("5524*****4137");
  });

  it("mascara tudo quando o número é muito curto", () => {
    expect(maskPhone("1234")).toBe("****");
  });
});
