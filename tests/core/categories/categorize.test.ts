import { describe, expect, it } from "vitest";
import { categorize, findCategory } from "@/core/categories";

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

  it("reconhece palavras-chave com acento", () => {
    expect(categorize("água", "expense")).toBe("Contas");
    expect(categorize("ônibus", "expense")).toBe("Transporte");
    expect(categorize("táxi", "expense")).toBe("Transporte");
  });
});

describe("categorize com categorias aprendidas", () => {
  it("usa o que o usuário ensinou no lugar do dicionário padrão", () => {
    expect(categorize("ifood", "expense", { ifood: "Lazer" })).toBe("Lazer");
  });

  it("acha o termo ensinado no meio da descrição", () => {
    expect(categorize("ifood do bar", "expense", { ifood: "Lazer" })).toBe("Lazer");
  });

  it("dá prioridade ao termo mais longo", () => {
    const learned = { ifood: "Lazer", "ifood lanche": "Alimentação" };
    expect(categorize("ifood lanche", "expense", learned)).toBe("Alimentação");
  });

  it("não casa pedaço de palavra", () => {
    expect(categorize("ifoods", "expense", { ifood: "Lazer" })).toBe("Outros");
  });

  it("ignora categoria aprendida que não existe pro tipo da transação", () => {
    // "Lazer" é de saída: uma entrada com esse termo continua usando o padrão.
    expect(categorize("pix", "income", { pix: "Lazer" })).toBe("Pix recebido");
  });

  it("outros termos continuam usando o dicionário padrão", () => {
    expect(categorize("uber", "expense", { ifood: "Lazer" })).toBe("Transporte");
  });
});

describe("findCategory", () => {
  it("acha a categoria ignorando maiúscula, acento e espaços extras", () => {
    expect(findCategory("lazer", "expense")).toBe("Lazer");
    expect(findCategory("ALIMENTACAO", "expense")).toBe("Alimentação");
    expect(findCategory("  pix   recebido ", "income")).toBe("Pix recebido");
  });

  it("devolve null pra categoria inexistente ou do tipo errado", () => {
    expect(findCategory("viagens", "expense")).toBeNull();
    expect(findCategory("salário", "expense")).toBeNull();
    expect(findCategory("lazer", "income")).toBeNull();
  });
});
