import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SummaryView } from "@/channels/app/summary-view";
import { calculateBudgetStatuses, type Budget } from "@/core/budgets/budget-status";
import { formatCurrency } from "@/core/replies/format-reply";
import { summarizeMonth, type StatementTransaction } from "@/core/summary/summarize-month";

// 10/11/2026 12:00 em São Paulo.
const NOW = new Date("2026-11-10T15:00:00Z");
const CURRENT = { year: 2026, month: 11 };

function expense(id: string, category: string, amountCents: number): StatementTransaction {
  return {
    id,
    type: "expense",
    amountCents,
    description: null,
    category,
    occurredOn: "2026-11-09",
  };
}

function render(transactions: StatementTransaction[], budgets: Budget[]): string {
  return renderToStaticMarkup(
    createElement(SummaryView, {
      month: CURRENT,
      current: CURRENT,
      now: NOW,
      summary: summarizeMonth(transactions),
      budgets: calculateBudgetStatuses(budgets, transactions),
    }),
  );
}

describe("SummaryView: orçamentos", () => {
  it("mostra gasto de e limite, a barra proporcional e quanto ainda cabe", () => {
    const html = render(
      [expense("1", "Delivery", 21000)],
      [{ category: "Delivery", limitCents: 30000 }],
    );

    expect(html).toContain("Orçamentos");
    expect(html).toContain(`${formatCurrency(21000)} de ${formatCurrency(30000)}`);
    expect(html).toContain("width:70%");
    expect(html).toContain(`70% · faltam ${formatCurrency(9000)}`);
  });

  it("perto do limite, avisa por escrito (não só pela cor)", () => {
    const html = render(
      [expense("1", "Delivery", 27000)],
      [{ category: "Delivery", limitCents: 30000 }],
    );

    expect(html).toContain("⚠️ 90% · faltam");
  });

  it("acima do limite, a barra para em 100% e a legenda diz quanto passou", () => {
    const html = render(
      [expense("1", "Delivery", 32000)],
      [{ category: "Delivery", limitCents: 30000 }],
    );

    expect(html).toContain("width:100%");
    expect(html).not.toContain("width:106%");
    expect(html).toContain(`🚨 106% · passou ${formatCurrency(2000)}`);
  });

  it("categoria com orçamento e nenhum gasto aparece em 0%", () => {
    const html = render(
      [expense("1", "Mercado", 5000)],
      [{ category: "Lazer", limitCents: 20000 }],
    );

    expect(html).toContain("Lazer");
    expect(html).toContain(`0% · faltam ${formatCurrency(20000)}`);
  });

  it("sem orçamentos, o bloco nem aparece", () => {
    const html = render([expense("1", "Delivery", 4500)], []);

    expect(html).not.toContain("Orçamentos");
    expect(html).toContain("Para onde foi o dinheiro");
  });

  it("sem orçamentos informados (tela como antes), continua funcionando", () => {
    const html = renderToStaticMarkup(
      createElement(SummaryView, {
        month: CURRENT,
        current: CURRENT,
        now: NOW,
        summary: summarizeMonth([expense("1", "Delivery", 4500)]),
      }),
    );

    expect(html).not.toContain("Orçamentos");
  });

  it("mês vazio mostra só a mensagem amigável, sem o bloco de orçamentos", () => {
    const html = render([], [{ category: "Delivery", limitCents: 30000 }]);

    expect(html).toContain("Nada registrado neste mês");
    expect(html).not.toContain("Orçamentos");
  });

  it("escapa o nome da categoria (nada vira HTML)", () => {
    const html = render(
      [expense("1", "<b>x</b>", 1000)],
      [{ category: "<b>x</b>", limitCents: 5000 }],
    );

    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
