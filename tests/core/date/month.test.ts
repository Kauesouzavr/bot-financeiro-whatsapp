import { describe, expect, it } from "vitest";
import {
  compareMonths,
  formatMonthParam,
  hasNextMonth,
  hasPreviousMonth,
  monthRange,
  nextMonth,
  parseMonthParam,
  previousMonth,
} from "@/core/date/month";

const CURRENT = { year: 2026, month: 11 };

describe("formatMonthParam", () => {
  it("usa dois dígitos no mês", () => {
    expect(formatMonthParam({ year: 2026, month: 3 })).toBe("2026-03");
    expect(formatMonthParam({ year: 2026, month: 11 })).toBe("2026-11");
  });
});

describe("previousMonth e nextMonth", () => {
  it("andam um mês dentro do mesmo ano", () => {
    expect(previousMonth({ year: 2026, month: 11 })).toEqual({ year: 2026, month: 10 });
    expect(nextMonth({ year: 2026, month: 3 })).toEqual({ year: 2026, month: 4 });
  });

  it("viram o ano em janeiro e dezembro", () => {
    expect(previousMonth({ year: 2026, month: 1 })).toEqual({ year: 2025, month: 12 });
    expect(nextMonth({ year: 2026, month: 12 })).toEqual({ year: 2027, month: 1 });
  });
});

describe("compareMonths", () => {
  it("compara ano e mês juntos", () => {
    expect(compareMonths({ year: 2026, month: 1 }, { year: 2025, month: 12 })).toBeGreaterThan(0);
    expect(compareMonths({ year: 2025, month: 12 }, { year: 2026, month: 1 })).toBeLessThan(0);
    expect(compareMonths({ year: 2026, month: 5 }, { year: 2026, month: 5 })).toBe(0);
  });
});

describe("monthRange", () => {
  it("vai do dia 1 ao dia 1 do mês seguinte", () => {
    expect(monthRange({ year: 2026, month: 11 })).toEqual({
      start: "2026-11-01",
      end: "2026-12-01",
    });
  });

  it("em dezembro, termina em janeiro do ano seguinte", () => {
    expect(monthRange({ year: 2026, month: 12 })).toEqual({
      start: "2026-12-01",
      end: "2027-01-01",
    });
  });
});

describe("hasPreviousMonth e hasNextMonth", () => {
  it("não deixa avançar além do mês atual", () => {
    expect(hasNextMonth({ year: 2026, month: 10 }, CURRENT)).toBe(true);
    expect(hasNextMonth(CURRENT, CURRENT)).toBe(false);
  });

  it("não deixa voltar além de janeiro de 2020", () => {
    expect(hasPreviousMonth({ year: 2020, month: 2 })).toBe(true);
    expect(hasPreviousMonth({ year: 2020, month: 1 })).toBe(false);
  });
});

describe("parseMonthParam", () => {
  it("lê um mês válido do passado", () => {
    expect(parseMonthParam("2026-10", CURRENT)).toEqual({ year: 2026, month: 10 });
    expect(parseMonthParam("2025-01", CURRENT)).toEqual({ year: 2025, month: 1 });
  });

  it("aceita o próprio mês atual", () => {
    expect(parseMonthParam("2026-11", CURRENT)).toEqual(CURRENT);
  });

  it("sem parâmetro, usa o mês atual", () => {
    expect(parseMonthParam(undefined, CURRENT)).toEqual(CURRENT);
    expect(parseMonthParam("", CURRENT)).toEqual(CURRENT);
  });

  it.each(["abc", "2026-1", "2026-13", "2026-00", "26-11", "2026-11-05", " 2026-11"])(
    "cai no mês atual quando o formato é inválido (%s)",
    (value) => {
      expect(parseMonthParam(value, CURRENT)).toEqual(CURRENT);
    },
  );

  it("cai no mês atual quando o mês está no futuro", () => {
    expect(parseMonthParam("2026-12", CURRENT)).toEqual(CURRENT);
    expect(parseMonthParam("2030-01", CURRENT)).toEqual(CURRENT);
  });

  it("cai no mês atual quando é anterior ao limite", () => {
    expect(parseMonthParam("2019-12", CURRENT)).toEqual(CURRENT);
    expect(parseMonthParam("2020-01", CURRENT)).toEqual({ year: 2020, month: 1 });
  });
});
