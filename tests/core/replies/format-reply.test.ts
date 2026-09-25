import { describe, expect, it } from "vitest";
import {
  formatBalance,
  formatConfirmation,
  formatCurrency,
  formatUnrecognized,
} from "@/core/replies/format-reply";

describe("formatCurrency", () => {
  it("formata centavos como R$", () => {
    expect(formatCurrency(4500)).toBe("R$ 45,00");
    expect(formatCurrency(123456)).toBe("R$ 1.234,56");
    expect(formatCurrency(0)).toBe("R$ 0,00");
  });
});

describe("formatConfirmation", () => {
  it("formata a linha de confirmação com descrição", () => {
    const text = formatConfirmation({
      type: "expense",
      amountCents: 4500,
      description: "ifood",
      category: "Delivery",
      occurredOn: "2026-09-15",
    });
    expect(text).toBe("✅ R$ 45,00 em Delivery (ifood)");
  });

  it("formata sem descrição quando não há", () => {
    const text = formatConfirmation({
      type: "expense",
      amountCents: 1000,
      description: null,
      category: "Outros",
      occurredOn: "2026-09-15",
    });
    expect(text).toBe("✅ R$ 10,00 em Outros");
  });
});

describe("formatBalance", () => {
  it("formata a linha do saldo do mês", () => {
    const text = formatBalance(
      { incomeCents: 150000, expenseCents: 62340, balanceCents: 87660 },
      { year: 2026, month: 9 },
    );
    expect(text).toBe("Setembro: entrou R$ 1.500,00 · saiu R$ 623,40 · saldo R$ 876,60");
  });
});

describe("formatUnrecognized", () => {
  it("pede pra reformular com um exemplo", () => {
    expect(formatUnrecognized()).toContain("gastei 45 no ifood");
  });
});
