import { resolveOccurredOn } from "../date/sao-paulo";
import type { MonthRef } from "../date/month";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// "Novembro de 2026"
export function formatMonthTitle(ref: MonthRef): string {
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(ref.year, ref.month - 1, 1)));
  return capitalize(label);
}

// "Hoje", "Ontem" ou "sáb, 08/11". O ano fica de fora: o título da tela já mostra o mês e o ano.
export function formatDayLabel(date: string, now: Date): string {
  if (date === resolveOccurredOn("today", now)) return "Hoje";
  if (date === resolveOccurredOn("yesterday", now)) return "Ontem";

  const [year, month, day] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday}, ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

// 0 vira "<1%" porque a categoria existe (valor maior que zero), só é pequena demais pra aparecer inteira.
export function formatPercent(percent: number): string {
  return percent === 0 ? "<1%" : `${percent}%`;
}
