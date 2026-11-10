import { describe, expect, it } from "vitest";
import { formatDayLabel, formatMonthTitle, formatPercent } from "@/core/summary/format-summary";

// 10/11/2026 12:00 em São Paulo (uma terça-feira).
const NOW = new Date("2026-11-10T15:00:00Z");

describe("formatMonthTitle", () => {
  it("escreve o mês por extenso, em português e com a inicial maiúscula", () => {
    expect(formatMonthTitle({ year: 2026, month: 11 })).toBe("Novembro de 2026");
    expect(formatMonthTitle({ year: 2027, month: 3 })).toBe("Março de 2027");
  });
});

describe("formatDayLabel", () => {
  it("chama o dia de hoje de Hoje e o de ontem de Ontem", () => {
    expect(formatDayLabel("2026-11-10", NOW)).toBe("Hoje");
    expect(formatDayLabel("2026-11-09", NOW)).toBe("Ontem");
  });

  it("mostra o dia da semana e a data nos outros dias", () => {
    expect(formatDayLabel("2026-11-08", NOW)).toBe("dom, 08/11");
    expect(formatDayLabel("2026-10-30", NOW)).toBe("sex, 30/10");
  });

  it("usa o fuso de São Paulo para decidir o que é hoje", () => {
    // 01:30 UTC de 10/11 ainda é 22:30 de 09/11 em São Paulo.
    const lateNight = new Date("2026-11-10T01:30:00Z");

    expect(formatDayLabel("2026-11-09", lateNight)).toBe("Hoje");
    expect(formatDayLabel("2026-11-08", lateNight)).toBe("Ontem");
  });
});

describe("formatPercent", () => {
  it("mostra o número com o símbolo de porcentagem", () => {
    expect(formatPercent(42)).toBe("42%");
    expect(formatPercent(100)).toBe("100%");
  });

  it("mostra <1% quando a porcentagem arredondou para zero", () => {
    expect(formatPercent(0)).toBe("<1%");
  });
});
