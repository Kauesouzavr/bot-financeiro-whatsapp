import { describe, expect, it } from "vitest";
import { calculateBalance } from "@/core/balance/calculate-balance";

describe("calculateBalance", () => {
  it("soma entradas e saídas em centavos e calcula o saldo", () => {
    const result = calculateBalance([
      { type: "income", amountCents: 150000 },
      { type: "expense", amountCents: 4500 },
      { type: "expense", amountCents: 1200 },
    ]);

    expect(result).toEqual({
      incomeCents: 150000,
      expenseCents: 5700,
      balanceCents: 144300,
    });
  });

  it("devolve zeros quando não há transações", () => {
    expect(calculateBalance([])).toEqual({
      incomeCents: 0,
      expenseCents: 0,
      balanceCents: 0,
    });
  });

  it("aceita saldo negativo", () => {
    const result = calculateBalance([
      { type: "income", amountCents: 1000 },
      { type: "expense", amountCents: 5000 },
    ]);

    expect(result.balanceCents).toBe(-4000);
  });
});
