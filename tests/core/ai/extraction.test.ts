import { describe, expect, it } from "vitest";
import {
  aiExtractionSchema,
  extractionToTransactions,
  type AiExtraction,
} from "@/core/ai/extraction";
import { NOW } from "../../helpers/fake-deps";

type AiItem = AiExtraction["transactions"][number];

function item(overrides: Partial<AiItem> = {}): AiItem {
  return {
    type: "expense",
    amount: "89,90",
    description: "ração do cachorro",
    date: "today",
    day_of_month: null,
    category: "Compras",
    ...overrides,
  };
}

function extraction(...items: AiItem[]): AiExtraction {
  return { transactions: items };
}

describe("aiExtractionSchema", () => {
  it("aceita uma extração válida", () => {
    expect(aiExtractionSchema.safeParse(extraction(item())).success).toBe(true);
  });

  it("aceita lista vazia (mensagem que não é registro financeiro)", () => {
    expect(aiExtractionSchema.safeParse({ transactions: [] }).success).toBe(true);
  });

  it.each([
    ["valor com formato fora do combinado", item({ amount: "R$ 89,90" })],
    ["valor com ponto de milhar", item({ amount: "1.234,56" })],
    ["valor com mais de duas casas decimais", item({ amount: "10,999" })],
    ["valor gigante", item({ amount: "99999999" })],
    ["tipo desconhecido", { ...item(), type: "transfer" }],
    ["data desconhecida", { ...item(), date: "amanha" }],
    ["dia do mês fora do intervalo", item({ date: "day_of_month", day_of_month: 40 })],
    ["descrição enorme", item({ description: "x".repeat(61) })],
  ])("rejeita %s", (_label, badItem) => {
    expect(aiExtractionSchema.safeParse({ transactions: [badItem] }).success).toBe(false);
  });

  it("rejeita mais de 10 transações", () => {
    const many = Array.from({ length: 11 }, () => item());
    expect(aiExtractionSchema.safeParse({ transactions: many }).success).toBe(false);
  });

  it("rejeita campos faltando e lixo no lugar do JSON", () => {
    expect(aiExtractionSchema.safeParse({}).success).toBe(false);
    expect(aiExtractionSchema.safeParse(null).success).toBe(false);
    expect(aiExtractionSchema.safeParse("texto solto").success).toBe(false);
  });
});

describe("extractionToTransactions", () => {
  it("converte o valor pra centavos inteiros e monta a transação", () => {
    const result = extractionToTransactions(extraction(item()), {}, NOW);

    expect(result).toEqual([
      {
        type: "expense",
        amountCents: 8990,
        description: "ração do cachorro",
        category: "Compras",
        occurredOn: "2026-09-15",
      },
    ]);
  });

  it("calcula a data em São Paulo: ontem e dia do mês", () => {
    const result = extractionToTransactions(
      extraction(item({ date: "yesterday" }), item({ date: "day_of_month", day_of_month: 10 })),
      {},
      NOW,
    );

    expect(result?.map((transaction) => transaction.occurredOn)).toEqual([
      "2026-09-14",
      "2026-09-10",
    ]);
  });

  it("devolve null quando a lista veio vazia", () => {
    expect(extractionToTransactions({ transactions: [] }, {}, NOW)).toBeNull();
  });

  it("devolve null se faltar o dia do mês quando a data é day_of_month", () => {
    const bad = extraction(item({ date: "day_of_month", day_of_month: null }));
    expect(extractionToTransactions(bad, {}, NOW)).toBeNull();
  });

  it("devolve null se algum item tiver valor zero, sem gravar os outros", () => {
    const bad = extraction(item(), item({ amount: "0" }));
    expect(extractionToTransactions(bad, {}, NOW)).toBeNull();
  });

  it("usa o dicionário padrão antes da sugestão da IA", () => {
    const result = extractionToTransactions(
      extraction(item({ description: "ifood", category: "Lazer" })),
      {},
      NOW,
    );
    expect(result?.[0].category).toBe("Delivery");
  });

  it("usa a categoria aprendida antes de tudo", () => {
    const result = extractionToTransactions(
      extraction(item({ description: "ifood", category: "Alimentação" })),
      { ifood: "Lazer" },
      NOW,
    );
    expect(result?.[0].category).toBe("Lazer");
  });

  it("ignora sugestão de categoria inválida ou do tipo errado", () => {
    const result = extractionToTransactions(
      extraction(
        item({ description: "xyz", category: "Inventada" }),
        item({ type: "income", description: "xyz", category: "Lazer" }),
      ),
      {},
      NOW,
    );
    expect(result?.map((transaction) => transaction.category)).toEqual([
      "Outros",
      "Outras entradas",
    ]);
  });

  it("padroniza a descrição em minúsculas e vira null quando vazia", () => {
    const result = extractionToTransactions(
      extraction(item({ description: "  Ração  " }), item({ description: "   " })),
      {},
      NOW,
    );
    expect(result?.map((transaction) => transaction.description)).toEqual(["ração", null]);
  });
});
