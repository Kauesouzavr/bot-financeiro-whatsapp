import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SummaryView } from "@/channels/app/summary-view";
import { formatCurrency } from "@/core/replies/format-reply";
import { summarizeMonth, type StatementTransaction } from "@/core/summary/summarize-month";

// 10/11/2026 12:00 em São Paulo.
const NOW = new Date("2026-11-10T15:00:00Z");
const CURRENT = { year: 2026, month: 11 };

const TRANSACTIONS: StatementTransaction[] = [
  {
    id: "1",
    type: "expense",
    amountCents: 4500,
    description: "ifood",
    category: "Delivery",
    occurredOn: "2026-11-10",
  },
  {
    id: "2",
    type: "expense",
    amountCents: 4500,
    description: null,
    category: "Mercado",
    occurredOn: "2026-11-09",
  },
  {
    id: "3",
    type: "income",
    amountCents: 150000,
    description: "salário",
    category: "Salário",
    occurredOn: "2026-11-05",
  },
];

function render(transactions: StatementTransaction[], month = CURRENT, current = CURRENT): string {
  return renderToStaticMarkup(
    createElement(SummaryView, { month, current, now: NOW, summary: summarizeMonth(transactions) }),
  );
}

describe("SummaryView", () => {
  it("mostra o mês, os totais e o saldo", () => {
    const html = render(TRANSACTIONS);

    expect(html).toContain("Novembro de 2026");
    expect(html).toContain(formatCurrency(150000)); // entrou
    expect(html).toContain(formatCurrency(9000)); // saiu
    expect(html).toContain(formatCurrency(141000)); // saldo
  });

  it("mostra os gastos por categoria com a porcentagem e a barra proporcional", () => {
    const html = render(TRANSACTIONS);

    expect(html).toContain("Para onde foi o dinheiro");
    expect(html).toContain("Delivery");
    expect(html).toContain("50%");
    expect(html).toContain("width:50%");
  });

  it("mostra o extrato com Hoje, Ontem e sinal + ou − em cada valor", () => {
    const html = render(TRANSACTIONS);

    expect(html).toContain("Hoje");
    expect(html).toContain("Ontem");
    expect(html).toContain(`− ${formatCurrency(4500)}`);
    expect(html).toContain(`+ ${formatCurrency(150000)}`);
  });

  it("usa a categoria como nome quando a transação não tem descrição", () => {
    const html = render([TRANSACTIONS[1]]);

    expect(html).toContain("Mercado");
    expect(html).not.toContain("null");
  });

  it("no mês atual, deixa voltar mas não avançar", () => {
    const html = render(TRANSACTIONS);

    expect(html).toContain('href="/app/resumo?mes=2026-10"');
    expect(html).toContain('aria-label="Mês anterior"');
    expect(html).not.toContain('aria-label="Próximo mês"');
  });

  it("num mês passado, deixa avançar e virar o ano", () => {
    const html = render(TRANSACTIONS, { year: 2026, month: 1 });

    expect(html).toContain('href="/app/resumo?mes=2025-12"');
    expect(html).toContain('href="/app/resumo?mes=2026-02"');
  });

  it("tem um caminho de volta para o chat", () => {
    expect(render(TRANSACTIONS)).toContain('href="/app"');
  });

  it("mostra uma mensagem amigável quando o mês está vazio", () => {
    const html = render([]);

    expect(html).toContain("Nada registrado neste mês");
    expect(html).not.toContain("Extrato");
    expect(html).not.toContain("Para onde foi o dinheiro");
  });

  it("escapa o texto que a pessoa digitou (nada vira HTML)", () => {
    const html = render([{ ...TRANSACTIONS[0], description: "<img src=x onerror=alert(1)>" }]);

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
