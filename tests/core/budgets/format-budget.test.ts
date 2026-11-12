import { describe, expect, it } from "vitest";
import {
  calculateBudgetStatuses,
  MAX_BUDGET_CENTS,
  type BudgetStatus,
} from "@/core/budgets/budget-status";
import {
  formatBudgetAlert,
  formatBudgetAmountTooHigh,
  formatBudgetList,
  formatBudgetNote,
  formatBudgetNotFound,
  formatBudgetRemoved,
  formatBudgetSet,
  formatInvalidBudgetAmount,
  formatNoBudgets,
} from "@/core/budgets/format-budget";
import { formatCurrency } from "@/core/replies/format-reply";

function status(spentCents: number, limitCents = 30000, category = "Delivery"): BudgetStatus {
  const [result] = calculateBudgetStatuses(
    [{ category, limitCents }],
    [{ type: "expense", amountCents: spentCents, category }],
  );
  return result;
}

const NOVEMBER = { year: 2026, month: 11 };

describe("formatBudgetAlert", () => {
  it("não fala nada enquanto está dentro do limite", () => {
    expect(formatBudgetAlert(status(21000))).toBeNull();
  });

  it("avisa com ⚠️ e a porcentagem quando chega perto", () => {
    expect(formatBudgetAlert(status(27000))).toBe(
      `⚠️ Delivery: ${formatCurrency(27000)} de ${formatCurrency(30000)} (90%)`,
    );
  });

  it("avisa com 🚨 e quanto passou quando estoura", () => {
    expect(formatBudgetAlert(status(32000))).toBe(
      `🚨 Delivery: ${formatCurrency(32000)} de ${formatCurrency(30000)} · passou ${formatCurrency(2000)}`,
    );
  });
});

describe("formatBudgetSet", () => {
  it("confirma o limite e mostra como o mês está", () => {
    expect(formatBudgetSet(status(21000))).toBe(
      `🎯 Orçamento de Delivery: ${formatCurrency(30000)} por mês.\nNeste mês: ${formatCurrency(21000)} (70%).`,
    );
  });

  it("avisa quando o mês já está perto do limite", () => {
    expect(formatBudgetSet(status(27000))).toContain("⚠️ Já está perto do limite.");
  });

  it("avisa quando o mês já passou do limite", () => {
    expect(formatBudgetSet(status(32000))).toContain(`🚨 Já passou ${formatCurrency(2000)}.`);
  });
});

describe("formatBudgetList", () => {
  it("lista cada orçamento com o mês no título, marcando só os que pedem atenção", () => {
    const statuses = calculateBudgetStatuses(
      [
        { category: "Delivery", limitCents: 30000 },
        { category: "Mercado", limitCents: 100000 },
      ],
      [
        { type: "expense", amountCents: 27000, category: "Delivery" },
        { type: "expense", amountCents: 10000, category: "Mercado" },
      ],
    );

    expect(formatBudgetList(statuses, NOVEMBER).split("\n")).toEqual([
      "🎯 Orçamentos de Novembro de 2026:",
      `• ⚠️ Delivery: ${formatCurrency(27000)} de ${formatCurrency(30000)} (90%)`,
      `• Mercado: ${formatCurrency(10000)} de ${formatCurrency(100000)} (10%)`,
    ]);
  });

  it("explica como criar o primeiro quando não há nenhum", () => {
    expect(formatBudgetList([], NOVEMBER)).toBe(formatNoBudgets());
    expect(formatNoBudgets()).toContain("orçamento delivery 300");
  });
});

describe("formatBudgetNote (legenda do Resumo)", () => {
  it("dentro do limite: porcentagem e quanto ainda cabe, sem emoji", () => {
    expect(formatBudgetNote(status(21000))).toBe(`70% · faltam ${formatCurrency(9000)}`);
  });

  it("perto do limite: ⚠️ e quanto ainda cabe", () => {
    expect(formatBudgetNote(status(27000))).toBe(`⚠️ 90% · faltam ${formatCurrency(3000)}`);
  });

  it("no limite exato: diz que o limite foi atingido em vez de 'faltam R$ 0,00'", () => {
    expect(formatBudgetNote(status(30000))).toBe("⚠️ 100% · limite atingido");
  });

  it("acima do limite: 🚨 e quanto passou", () => {
    expect(formatBudgetNote(status(32000))).toBe(`🚨 106% · passou ${formatCurrency(2000)}`);
  });
});

describe("outras mensagens", () => {
  it("remoção, ausência e valor inválido", () => {
    expect(formatBudgetRemoved("Lazer")).toBe("🗑️ Orçamento de Lazer removido.");
    expect(formatBudgetNotFound("Lazer")).toBe("Você não tem orçamento em Lazer.");
    expect(formatInvalidBudgetAmount()).toContain("maior que zero");
  });

  it("valor alto demais diz qual é o máximo", () => {
    expect(formatBudgetAmountTooHigh()).toContain(formatCurrency(MAX_BUDGET_CENTS));
  });
});
