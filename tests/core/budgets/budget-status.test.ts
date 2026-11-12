import { describe, expect, it } from "vitest";
import {
  BUDGET_WARNING_PERCENT,
  calculateBudgetStatuses,
  type CategorizedTransaction,
} from "@/core/budgets/budget-status";

function expense(category: string, amountCents: number): CategorizedTransaction {
  return { type: "expense", amountCents, category };
}

describe("calculateBudgetStatuses", () => {
  it("soma só os gastos da categoria do orçamento", () => {
    const [status] = calculateBudgetStatuses(
      [{ category: "Delivery", limitCents: 30000 }],
      [
        expense("Delivery", 4500),
        expense("Delivery", 16500),
        expense("Mercado", 99900),
        { type: "income", amountCents: 150000, category: "Delivery" },
      ],
    );

    expect(status).toMatchObject({
      category: "Delivery",
      limitCents: 30000,
      spentCents: 21000,
      remainingCents: 9000,
      overCents: 0,
      percent: 70,
      state: "ok",
    });
  });

  it("categoria sem gasto no mês fica em 0% e dentro do limite", () => {
    const [status] = calculateBudgetStatuses([{ category: "Lazer", limitCents: 20000 }], []);

    expect(status).toMatchObject({ spentCents: 0, percent: 0, state: "ok", remainingCents: 20000 });
  });

  it(`vira atenção ao chegar em ${BUDGET_WARNING_PERCENT}% exatos`, () => {
    const [status] = calculateBudgetStatuses(
      [{ category: "Delivery", limitCents: 30000 }],
      [expense("Delivery", 24000)],
    );

    expect(status.percent).toBe(80);
    expect(status.state).toBe("warning");
  });

  it("um centavo antes dos 80% ainda está ok", () => {
    const [status] = calculateBudgetStatuses(
      [{ category: "Delivery", limitCents: 30000 }],
      [expense("Delivery", 23999)],
    );

    expect(status.state).toBe("ok");
    expect(status.percent).toBe(79);
  });

  it("no limite exato ainda não estourou: fica em atenção, com 100% e nada sobrando", () => {
    const [status] = calculateBudgetStatuses(
      [{ category: "Delivery", limitCents: 30000 }],
      [expense("Delivery", 30000)],
    );

    expect(status).toMatchObject({
      percent: 100,
      state: "warning",
      remainingCents: 0,
      overCents: 0,
    });
  });

  it("estoura quando passa do limite, mesmo que seja por um centavo", () => {
    const [status] = calculateBudgetStatuses(
      [{ category: "Delivery", limitCents: 30000 }],
      [expense("Delivery", 30001)],
    );

    expect(status).toMatchObject({ state: "exceeded", overCents: 1, remainingCents: 0 });
  });

  it("mostra quanto passou e a porcentagem acima de 100", () => {
    const [status] = calculateBudgetStatuses(
      [{ category: "Delivery", limitCents: 30000 }],
      [expense("Delivery", 32000)],
    );

    expect(status).toMatchObject({ percent: 106, overCents: 2000, state: "exceeded" });
  });

  it("arredonda a porcentagem para baixo, para nunca mostrar 100% sem ter chegado lá", () => {
    const [status] = calculateBudgetStatuses(
      [{ category: "Delivery", limitCents: 30000 }],
      [expense("Delivery", 29999)],
    );

    expect(status.percent).toBe(99);
  });

  it("ordena do mais apertado para o mais folgado e desempata pelo nome", () => {
    const statuses = calculateBudgetStatuses(
      [
        { category: "Mercado", limitCents: 100000 },
        { category: "Lazer", limitCents: 10000 },
        { category: "Delivery", limitCents: 10000 },
        { category: "Transporte", limitCents: 10000 },
      ],
      [expense("Lazer", 5000), expense("Delivery", 5000), expense("Mercado", 90000)],
    );

    expect(statuses.map((status) => status.category)).toEqual([
      "Mercado",
      "Delivery",
      "Lazer",
      "Transporte",
    ]);
  });

  it("ignora orçamento com limite zero em vez de dividir por zero", () => {
    expect(calculateBudgetStatuses([{ category: "Delivery", limitCents: 0 }], [])).toEqual([]);
  });

  it("sem orçamentos, devolve lista vazia", () => {
    expect(calculateBudgetStatuses([], [expense("Delivery", 100)])).toEqual([]);
  });
});
