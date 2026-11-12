import { afterEach, describe, expect, it, vi } from "vitest";
import { getBudgetAlertLines } from "@/core/budgets/budget-alerts";
import type { Budget, CategorizedTransaction } from "@/core/budgets/budget-status";
import { formatCurrency } from "@/core/replies/format-reply";
import type { ParsedTransaction } from "@/core/types";

const NOVEMBER = { year: 2026, month: 11 };

function saved(overrides: Partial<ParsedTransaction> = {}): ParsedTransaction {
  return {
    type: "expense",
    amountCents: 4500,
    description: "ifood",
    category: "Delivery",
    occurredOn: "2026-11-10",
    ...overrides,
  };
}

function month(...items: [string, number][]): CategorizedTransaction[] {
  return items.map(([category, amountCents]) => ({ type: "expense", amountCents, category }));
}

function input(budgets: Budget[], overrides: Partial<Parameters<typeof getBudgetAlertLines>[0]>) {
  return {
    loadBudgets: vi.fn(async () => budgets),
    monthTransactions: month(["Delivery", 27000]),
    saved: [saved()],
    month: NOVEMBER,
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("getBudgetAlertLines", () => {
  it("avisa quando o gasto novo deixa a categoria em atenção", async () => {
    const lines = await getBudgetAlertLines(
      input([{ category: "Delivery", limitCents: 30000 }], {}),
    );

    expect(lines).toEqual([
      `⚠️ Delivery: ${formatCurrency(27000)} de ${formatCurrency(30000)} (90%)`,
    ]);
  });

  it("fica quieto enquanto a categoria está dentro do limite", async () => {
    const lines = await getBudgetAlertLines(
      input([{ category: "Delivery", limitCents: 100000 }], {}),
    );

    expect(lines).toEqual([]);
  });

  it("só avisa das categorias do gasto novo, não de outros orçamentos apertados", async () => {
    const lines = await getBudgetAlertLines(
      input(
        [
          { category: "Delivery", limitCents: 30000 },
          { category: "Mercado", limitCents: 10000 },
        ],
        { monthTransactions: month(["Delivery", 27000], ["Mercado", 15000]) },
      ),
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Delivery");
  });

  it("não lê orçamento nenhum quando entrou dinheiro", async () => {
    const options = input([{ category: "Delivery", limitCents: 30000 }], {
      saved: [saved({ type: "income", category: "Salário" })],
    });

    expect(await getBudgetAlertLines(options)).toEqual([]);
    expect(options.loadBudgets).not.toHaveBeenCalled();
  });

  it("não mexe no orçamento deste mês quando o gasto é de outro mês", async () => {
    const options = input([{ category: "Delivery", limitCents: 30000 }], {
      saved: [saved({ occurredOn: "2026-10-30" })],
    });

    expect(await getBudgetAlertLines(options)).toEqual([]);
    expect(options.loadBudgets).not.toHaveBeenCalled();
  });

  it("uma mensagem com vários gastos avisa de cada categoria apertada, a mais crítica primeiro", async () => {
    const lines = await getBudgetAlertLines(
      input(
        [
          { category: "Delivery", limitCents: 30000 },
          { category: "Transporte", limitCents: 10000 },
        ],
        {
          saved: [saved(), saved({ category: "Transporte", description: "uber" })],
          monthTransactions: month(["Delivery", 27000], ["Transporte", 12000]),
        },
      ),
    );

    expect(lines.map((line) => line.slice(0, 2))).toEqual(["🚨", "⚠️"]);
  });

  it("se a leitura dos orçamentos falhar, não derruba o registro: devolve vazio e loga só o tipo do erro", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const options = input([], {
      loadBudgets: vi.fn(async () => {
        throw new TypeError("relation budgets does not exist: R$ 270,00");
      }),
    });

    expect(await getBudgetAlertLines(options)).toEqual([]);
    expect(log).toHaveBeenCalledWith("Erro ao ler os orçamentos:", "TypeError");
  });
});
