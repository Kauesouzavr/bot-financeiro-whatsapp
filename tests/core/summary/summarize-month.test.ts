import { describe, expect, it } from "vitest";
import { summarizeMonth, type StatementTransaction } from "@/core/summary/summarize-month";

let nextId = 0;

function tx(
  overrides: Partial<StatementTransaction> & Pick<StatementTransaction, "amountCents">,
): StatementTransaction {
  nextId += 1;
  return {
    id: `tx-${nextId}`,
    type: "expense",
    description: null,
    category: "Outros",
    occurredOn: "2026-11-05",
    ...overrides,
  };
}

describe("summarizeMonth", () => {
  it("devolve tudo zerado e vazio quando não há transações", () => {
    expect(summarizeMonth([])).toEqual({
      balance: { incomeCents: 0, expenseCents: 0, balanceCents: 0 },
      expensesByCategory: [],
      incomesByCategory: [],
      days: [],
    });
  });

  it("calcula entrou, saiu e saldo em centavos", () => {
    const summary = summarizeMonth([
      tx({ type: "income", amountCents: 150000, category: "Salário" }),
      tx({ amountCents: 4500, category: "Delivery" }),
      tx({ amountCents: 1200, category: "Transporte" }),
    ]);

    expect(summary.balance).toEqual({
      incomeCents: 150000,
      expenseCents: 5700,
      balanceCents: 144300,
    });
  });

  describe("gastos por categoria", () => {
    it("soma por categoria, da maior para a menor, com a porcentagem", () => {
      const summary = summarizeMonth([
        tx({ amountCents: 2000, category: "Transporte" }),
        tx({ amountCents: 3000, category: "Mercado" }),
        tx({ amountCents: 2000, category: "Mercado" }),
        tx({ amountCents: 3000, category: "Delivery" }),
      ]);

      expect(summary.expensesByCategory).toEqual([
        { category: "Mercado", totalCents: 5000, percent: 50 },
        { category: "Delivery", totalCents: 3000, percent: 30 },
        { category: "Transporte", totalCents: 2000, percent: 20 },
      ]);
    });

    it("não mistura entradas com gastos", () => {
      const summary = summarizeMonth([
        tx({ type: "income", amountCents: 100000, category: "Salário" }),
        tx({ amountCents: 5000, category: "Mercado" }),
      ]);

      expect(summary.expensesByCategory).toEqual([
        { category: "Mercado", totalCents: 5000, percent: 100 },
      ]);
      expect(summary.incomesByCategory).toEqual([
        { category: "Salário", totalCents: 100000, percent: 100 },
      ]);
    });

    it("desempata valores iguais pelo nome da categoria", () => {
      const summary = summarizeMonth([
        tx({ amountCents: 1000, category: "Lazer" }),
        tx({ amountCents: 1000, category: "Delivery" }),
        tx({ amountCents: 1000, category: "Ágil" }),
      ]);

      expect(summary.expensesByCategory.map((item) => item.category)).toEqual([
        "Ágil",
        "Delivery",
        "Lazer",
      ]);
    });

    it("arredonda a porcentagem pro inteiro mais próximo (a soma pode dar 99 ou 101)", () => {
      const summary = summarizeMonth([
        tx({ amountCents: 1000, category: "Mercado" }),
        tx({ amountCents: 1000, category: "Lazer" }),
        tx({ amountCents: 1000, category: "Saúde" }),
      ]);

      expect(summary.expensesByCategory.map((item) => item.percent)).toEqual([33, 33, 33]);
    });

    it("mostra 0% para uma categoria minúscula, mas mantém o valor", () => {
      const summary = summarizeMonth([
        tx({ amountCents: 100000, category: "Moradia" }),
        tx({ amountCents: 1, category: "Outros" }),
      ]);

      expect(summary.expensesByCategory[1]).toEqual({
        category: "Outros",
        totalCents: 1,
        percent: 0,
      });
    });
  });

  describe("extrato por dia", () => {
    it("agrupa por dia, do mais recente para o mais antigo", () => {
      const summary = summarizeMonth([
        tx({ id: "a", amountCents: 100, occurredOn: "2026-11-08" }),
        tx({ id: "b", amountCents: 200, occurredOn: "2026-11-10" }),
        tx({ id: "c", amountCents: 300, occurredOn: "2026-11-09" }),
        tx({ id: "d", amountCents: 400, occurredOn: "2026-11-10" }),
      ]);

      expect(summary.days.map((day) => day.date)).toEqual([
        "2026-11-10",
        "2026-11-09",
        "2026-11-08",
      ]);
      expect(summary.days[0].transactions.map((item) => item.id)).toEqual(["b", "d"]);
    });

    it("mantém a ordem recebida dentro do mesmo dia (o banco já manda a mais nova primeiro)", () => {
      const summary = summarizeMonth([
        tx({ id: "nova", amountCents: 100, occurredOn: "2026-11-10" }),
        tx({ id: "velha", amountCents: 100, occurredOn: "2026-11-10" }),
      ]);

      expect(summary.days[0].transactions.map((item) => item.id)).toEqual(["nova", "velha"]);
    });

    it("inclui entradas e gastos no extrato", () => {
      const summary = summarizeMonth([
        tx({ type: "income", amountCents: 100000, category: "Salário" }),
        tx({ amountCents: 4500, category: "Delivery" }),
      ]);

      expect(summary.days[0].transactions).toHaveLength(2);
    });
  });
});
