import { describe, expect, it } from "vitest";
import { getSaoPauloParts, resolveOccurredOn } from "@/core/date/sao-paulo";

describe("getSaoPauloParts", () => {
  it("lê a data no fuso de São Paulo (UTC-3), não em UTC", () => {
    // 2026-09-15T02:00:00Z ainda é 2026-09-14 no horário de São Paulo.
    const parts = getSaoPauloParts(new Date("2026-09-15T02:00:00Z"));
    expect(parts).toEqual({ year: 2026, month: 9, day: 14 });
  });
});

describe("resolveOccurredOn", () => {
  const now = new Date("2026-09-15T15:00:00Z");

  it('"today" usa a data atual em SP', () => {
    expect(resolveOccurredOn("today", now)).toBe("2026-09-15");
  });

  it('"yesterday" volta um dia', () => {
    expect(resolveOccurredOn("yesterday", now)).toBe("2026-09-14");
  });

  it('"yesterday" cruza virada de mês corretamente', () => {
    const firstOfMonth = new Date("2026-10-01T15:00:00Z");
    expect(resolveOccurredOn("yesterday", firstOfMonth)).toBe("2026-09-30");
  });

  it("{ day } usa o dia informado no mês atual", () => {
    expect(resolveOccurredOn({ day: 10 }, now)).toBe("2026-09-10");
  });
});
