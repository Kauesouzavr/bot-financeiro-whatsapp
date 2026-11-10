import { z } from "zod";
import { categorize, FALLBACK_CATEGORY, findCategory, type LearnedCategories } from "../categories";
import { getSaoPauloParts, formatDateOnly } from "../date/sao-paulo";
import { parseMoneyToCents } from "../parser/parse-money";
import { formatCurrency } from "../replies/format-reply";
import type { ParsedTransaction } from "../types";
import { AI_AMOUNT_PATTERN } from "./extraction";

// Tipos de arquivo e tamanho aceitos como comprovante. O limite é menor que o do servidor
// (4 MB de corpo) pra sobrar espaço pro envelope do formulário.
export const RECEIPT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export const RECEIPT_MAX_BYTES = 3 * 1024 * 1024;

// A pendência de confirmação vale 24 horas (regra do projeto).
export const PENDING_RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;

// O que o modelo devolve ao ler um comprovante. O valor vem como TEXTO ("45,90"): quem converte
// pra centavos é o nosso parseMoneyToCents, nunca o modelo (nada de float).
export const receiptExtractionSchema = z.object({
  is_receipt: z.boolean(),
  kind: z.enum(["expense", "income"]),
  // Sem regra de formato aqui de propósito: se não for comprovante o modelo pode devolver qualquer coisa.
  // O formato só é conferido no mapeamento, quando is_receipt é verdadeiro.
  amount: z.string().max(30),
  counterparty: z.string().max(80).nullable(),
  date: z.string().max(10).nullable(),
  category: z.string().max(40),
});

export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;

// A transação que fica guardada na pendência até a pessoa tocar em Salvar. É conferida de novo
// ao ler do banco: nunca confiamos cegamente num JSON guardado.
export const pendingTransactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amountCents: z.number().int().positive().max(99_999_999),
  description: z.string().max(80).nullable(),
  category: z.string().max(40),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ReceiptFailure = "not_receipt" | "unreadable" | "bad_date";

export type ReceiptMapping =
  { ok: true; transaction: ParsedTransaction } | { ok: false; reason: ReceiptFailure };

const MAX_PAST_DAYS = 400;

// Devolve a data (AAAA-MM-DD) se ela existir de verdade e for plausível: não pode estar no futuro
// (tolerando 1 dia, por causa do fuso) nem ser mais velha que ~13 meses. Senão, null.
function plausibleDate(raw: string, now: Date): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const asDate = new Date(Date.UTC(year, month - 1, day));
  const exists =
    asDate.getUTCFullYear() === year &&
    asDate.getUTCMonth() === month - 1 &&
    asDate.getUTCDate() === day;
  if (!exists) return null;

  const today = getSaoPauloParts(now);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((todayUtc - asDate.getTime()) / dayMs);
  if (diffDays < -1 || diffDays > MAX_PAST_DAYS) return null;

  return formatDateOnly({ year, month, day });
}

// Transforma o que o modelo leu numa transação pendente. Se algo não faz sentido, devolve o motivo
// em vez de gravar um valor duvidoso: melhor pedir outra foto do que errar o seu dinheiro.
export function receiptToPendingTransaction(
  extraction: ReceiptExtraction,
  learned: LearnedCategories,
  now: Date,
): ReceiptMapping {
  if (!extraction.is_receipt) return { ok: false, reason: "not_receipt" };

  const amount = extraction.amount.trim();
  if (!AI_AMOUNT_PATTERN.test(amount)) return { ok: false, reason: "unreadable" };
  const amountCents = parseMoneyToCents(amount);
  if (amountCents === null || amountCents <= 0) return { ok: false, reason: "unreadable" };

  let occurredOn: string;
  if (extraction.date === null || extraction.date.trim() === "") {
    occurredOn = formatDateOnly(getSaoPauloParts(now));
  } else {
    const checked = plausibleDate(extraction.date.trim(), now);
    if (!checked) return { ok: false, reason: "bad_date" };
    occurredOn = checked;
  }

  const description = extraction.counterparty?.trim().toLowerCase() || null;

  // Mesma ordem do texto: o que a pessoa ensinou e o dicionário vêm antes da sugestão da IA.
  let category = categorize(description ?? "", extraction.kind, learned);
  if (category === FALLBACK_CATEGORY[extraction.kind]) {
    category = findCategory(extraction.category, extraction.kind) ?? category;
  }

  return {
    ok: true,
    transaction: { type: extraction.kind, amountCents, description, category, occurredOn },
  };
}

function formatDateBr(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

// Texto da mensagem do bot logo depois de ler o comprovante, antes de salvar.
export function formatReceiptPrompt(transaction: ParsedTransaction): string {
  const direction = transaction.type === "expense" ? "💸 Saída" : "💰 Entrada";
  const description = transaction.description ? ` (${transaction.description})` : "";
  return [
    "Li o comprovante:",
    `${direction} de ${formatCurrency(transaction.amountCents)} em ${transaction.category}${description}`,
    `📅 ${formatDateBr(transaction.occurredOn)}`,
    "Confere? Toque em Salvar ou Cancelar. Esta confirmação vale por 24 horas.",
  ].join("\n");
}

// Resumo de uma linha, mostrado no cartão de confirmação.
export function formatReceiptSummary(transaction: ParsedTransaction): string {
  const direction = transaction.type === "expense" ? "Saída" : "Entrada";
  const description = transaction.description ? ` · ${transaction.description}` : "";
  return `${direction} de ${formatCurrency(transaction.amountCents)}${description} · ${formatDateBr(transaction.occurredOn)}`;
}

export const RECEIPT_MESSAGES = {
  notReceipt:
    'Isso não parece um comprovante de pagamento ou Pix. Tente outra imagem, ou escreva o gasto, tipo "gastei 45 no mercado".',
  unreadable:
    "Não consegui ler o valor desse comprovante. Tente uma foto mais nítida, com o valor visível.",
  badDate:
    "A data desse comprovante me pareceu estranha. Tente uma foto mais nítida, ou escreva o gasto.",
  failed: "Não consegui analisar o comprovante agora. Tente de novo em instantes.",
  invalidFile: "Mande uma imagem (foto ou print) ou um PDF de até 3 MB.",
  alreadyHandled: "Esse comprovante já foi tratado ou a confirmação expirou. Mande-o de novo.",
  cancelled: "Cancelado. Nada foi registrado.",
} as const;
