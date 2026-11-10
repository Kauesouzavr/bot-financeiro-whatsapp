export interface MonthRef {
  year: number;
  month: number; // 1 a 12
}

// Primeiro ano aceito na tela de resumo: evita que um "?mes=0001-01" na URL vire uma consulta sem sentido.
export const MIN_SUMMARY_YEAR = 2020;

const MONTH_PARAM = /^(\d{4})-(\d{2})$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// "2026-11": o formato do mês na URL (?mes=2026-11).
export function formatMonthParam(ref: MonthRef): string {
  return `${ref.year}-${pad(ref.month)}`;
}

export function previousMonth(ref: MonthRef): MonthRef {
  return ref.month === 1
    ? { year: ref.year - 1, month: 12 }
    : { year: ref.year, month: ref.month - 1 };
}

export function nextMonth(ref: MonthRef): MonthRef {
  return ref.month === 12
    ? { year: ref.year + 1, month: 1 }
    : { year: ref.year, month: ref.month + 1 };
}

// Negativo se a vem antes de b, zero se são o mesmo mês, positivo se a vem depois.
export function compareMonths(a: MonthRef, b: MonthRef): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

// Intervalo de datas do mês, no formato do banco: do dia 1 (inclusive) ao dia 1 do mês seguinte (exclusivo).
export function monthRange(ref: MonthRef): { start: string; end: string } {
  const next = nextMonth(ref);
  return {
    start: `${formatMonthParam(ref)}-01`,
    end: `${formatMonthParam(next)}-01`,
  };
}

export function hasPreviousMonth(ref: MonthRef): boolean {
  return compareMonths(ref, { year: MIN_SUMMARY_YEAR, month: 1 }) > 0;
}

export function hasNextMonth(ref: MonthRef, current: MonthRef): boolean {
  return compareMonths(ref, current) < 0;
}

// Lê o ?mes= da URL. Qualquer coisa inválida, anterior ao limite ou no futuro cai no mês atual:
// a tela nunca quebra por causa de um endereço digitado errado.
export function parseMonthParam(value: string | undefined, current: MonthRef): MonthRef {
  const match = value ? MONTH_PARAM.exec(value) : null;
  if (!match) return { year: current.year, month: current.month };

  const requested = { year: Number(match[1]), month: Number(match[2]) };
  const isValidMonth = requested.month >= 1 && requested.month <= 12;
  if (!isValidMonth || requested.year < MIN_SUMMARY_YEAR || compareMonths(requested, current) > 0) {
    return { year: current.year, month: current.month };
  }
  return requested;
}
