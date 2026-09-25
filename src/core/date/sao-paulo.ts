const TIME_ZONE = "America/Sao_Paulo";

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export type DateModifier = "today" | "yesterday" | { day: number };

// Formata a data no fuso de SP e lê os componentes de volta: evita depender
// do fuso horário da máquina que roda o código (dev, CI ou Vercel podem ser diferentes).
export function getSaoPauloParts(date: Date = new Date()): DateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

function toUtcDate(parts: DateParts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDateOnly(parts: DateParts): string {
  return toIsoDate(toUtcDate(parts));
}

export function resolveOccurredOn(modifier: DateModifier, now: Date = new Date()): string {
  const today = getSaoPauloParts(now);

  if (modifier === "today") return formatDateOnly(today);

  if (modifier === "yesterday") {
    const yesterday = toUtcDate(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return toIsoDate(yesterday);
  }

  return formatDateOnly({ year: today.year, month: today.month, day: modifier.day });
}
