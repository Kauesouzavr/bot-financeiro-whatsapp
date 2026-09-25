import { describe, expect, it } from "vitest";
import { parseMessage } from "@/core/parser/parse-message";

// Data fixa (terça, 2026-09-15) pra "ontem"/"dia N" não dependerem de quando o teste roda.
const NOW = new Date("2026-09-15T15:00:00Z");

describe("parseMessage", () => {
  it('entende "gastei 45 no ifood"', () => {
    const result = parseMessage("gastei 45 no ifood", NOW);
    expect(result).toEqual([
      {
        type: "expense",
        amountCents: 4500,
        description: "ifood",
        category: "Delivery",
        occurredOn: "2026-09-15",
      },
    ]);
  });

  it('entende "45,90 mercado" (sem verbo, assume gasto)', () => {
    const result = parseMessage("45,90 mercado", NOW);
    expect(result).toEqual([
      {
        type: "expense",
        amountCents: 4590,
        description: "mercado",
        category: "Mercado",
        occurredOn: "2026-09-15",
      },
    ]);
  });

  it('entende "uber 23 ontem"', () => {
    const result = parseMessage("uber 23 ontem", NOW);
    expect(result).toEqual([
      {
        type: "expense",
        amountCents: 2300,
        description: "uber",
        category: "Transporte",
        occurredOn: "2026-09-14",
      },
    ]);
  });

  it('entende "R$ 1.234,56 aluguel"', () => {
    const result = parseMessage("R$ 1.234,56 aluguel", NOW);
    expect(result).toEqual([
      {
        type: "expense",
        amountCents: 123456,
        description: "aluguel",
        category: "Moradia",
        occurredOn: "2026-09-15",
      },
    ]);
  });

  it('entende "gastei 30 reais no mercado"', () => {
    const result = parseMessage("gastei 30 reais no mercado", NOW);
    expect(result).toEqual([
      {
        type: "expense",
        amountCents: 3000,
        description: "mercado",
        category: "Mercado",
        occurredOn: "2026-09-15",
      },
    ]);
  });

  it('entende "20 conto no lanche"', () => {
    const result = parseMessage("20 conto no lanche", NOW);
    expect(result).toEqual([
      {
        type: "expense",
        amountCents: 2000,
        description: "lanche",
        category: "Alimentação",
        occurredOn: "2026-09-15",
      },
    ]);
  });

  it('entende "recebi 1500 salário"', () => {
    const result = parseMessage("recebi 1500 salário", NOW);
    expect(result).toEqual([
      {
        type: "income",
        amountCents: 150000,
        description: "salário",
        category: "Salário",
        occurredOn: "2026-09-15",
      },
    ]);
  });

  it('entende "paguei 120 de luz dia 10"', () => {
    const result = parseMessage("paguei 120 de luz dia 10", NOW);
    expect(result).toEqual([
      {
        type: "expense",
        amountCents: 12000,
        description: "luz",
        category: "Contas",
        occurredOn: "2026-09-10",
      },
    ]);
  });

  it('entende "gastei 45 no ifood e 12 no uber" como duas transações', () => {
    const result = parseMessage("gastei 45 no ifood e 12 no uber", NOW);
    expect(result).toEqual([
      {
        type: "expense",
        amountCents: 4500,
        description: "ifood",
        category: "Delivery",
        occurredOn: "2026-09-15",
      },
      {
        type: "expense",
        amountCents: 1200,
        description: "uber",
        category: "Transporte",
        occurredOn: "2026-09-15",
      },
    ]);
  });

  it("retorna null quando não reconhece a mensagem", () => {
    expect(parseMessage("oi, tudo bem?", NOW)).toBeNull();
  });

  it("retorna null quando não tem valor", () => {
    expect(parseMessage("gastei no ifood", NOW)).toBeNull();
  });
});
