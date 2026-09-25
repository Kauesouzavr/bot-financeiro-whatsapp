import { describe, expect, it } from "vitest";
import { categorize } from "@/core/categories";

describe("categorize", () => {
  it("reconhece categorias de despesa por palavra-chave", () => {
    expect(categorize("ifood", "expense")).toBe("Delivery");
    expect(categorize("mercado", "expense")).toBe("Mercado");
    expect(categorize("uber", "expense")).toBe("Transporte");
    expect(categorize("aluguel", "expense")).toBe("Moradia");
    expect(categorize("luz", "expense")).toBe("Contas");
    expect(categorize("lanche", "expense")).toBe("Alimentação");
  });

  it("reconhece categorias de entrada por palavra-chave", () => {
    expect(categorize("salário", "income")).toBe("Salário");
    expect(categorize("freela", "income")).toBe("Freela");
    expect(categorize("pix", "income")).toBe("Pix recebido");
  });

  it("cai em Outros/Outras entradas quando não reconhece nada", () => {
    expect(categorize("xyz123", "expense")).toBe("Outros");
    expect(categorize("xyz123", "income")).toBe("Outras entradas");
  });

  it("não confunde palavras parecidas (word boundary)", () => {
    // "condominio" não deveria bater com uma keyword tipo "pix" por acaso
    expect(categorize("condominio", "expense")).toBe("Moradia");
  });
});
