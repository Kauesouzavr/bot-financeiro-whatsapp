import { z } from "zod";
import { categorize, FALLBACK_CATEGORY, findCategory, type LearnedCategories } from "../categories";
import { resolveOccurredOn, type DateModifier } from "../date/sao-paulo";
import { parseMoneyToCents } from "../parser/parse-money";
import type { ParsedTransaction } from "../types";

export const MAX_AI_TRANSACTIONS = 10;

// O modelo devolve o valor como TEXTO ("45", "45,90"), nunca como número: quem converte
// pra centavos inteiros é o nosso parseMoneyToCents, sem passar por float.
// Até 6 dígitos (R$ 999.999,99): acima disso é quase certo que a IA errou.
export const AI_AMOUNT_PATTERN = /^\d{1,6}(,\d{1,2})?$/;

const aiTransactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.string().regex(AI_AMOUNT_PATTERN),
  description: z.string().max(60).nullable(),
  // A IA só diz QUAL dia ("ontem", "dia 10"); a data de verdade é calculada por nós em America/Sao_Paulo.
  date: z.enum(["today", "yesterday", "day_of_month"]),
  day_of_month: z.number().int().min(1).max(31).nullable(),
  // Só uma sugestão: o mapeamento abaixo confere se é uma categoria válida antes de usar.
  category: z.string(),
});

export const aiExtractionSchema = z.object({
  transactions: z.array(aiTransactionSchema).max(MAX_AI_TRANSACTIONS),
});

export type AiExtraction = z.infer<typeof aiExtractionSchema>;

// Transforma o que a IA extraiu nas mesmas ParsedTransaction do parser por regras.
// Devolve null se a lista veio vazia (não era um registro financeiro) ou se algum item não faz sentido:
// melhor pedir pra reformular do que gravar um valor duvidoso.
export function extractionToTransactions(
  extraction: AiExtraction,
  learned: LearnedCategories,
  now: Date,
): ParsedTransaction[] | null {
  if (extraction.transactions.length === 0) return null;

  const result: ParsedTransaction[] = [];

  for (const item of extraction.transactions) {
    const amountCents = parseMoneyToCents(item.amount);
    if (amountCents === null || amountCents <= 0) return null;

    let dateModifier: DateModifier;
    if (item.date === "day_of_month") {
      if (item.day_of_month === null) return null;
      dateModifier = { day: item.day_of_month };
    } else {
      dateModifier = item.date;
    }

    const description = item.description?.trim().toLowerCase() || null;

    // Dicionário e categorias aprendidas têm prioridade; a sugestão da IA só entra
    // quando eles não reconhecem nada (cairia em "Outros"/"Outras entradas").
    let category = categorize(description ?? "", item.type, learned);
    if (category === FALLBACK_CATEGORY[item.type]) {
      category = findCategory(item.category, item.type) ?? category;
    }

    result.push({
      type: item.type,
      amountCents,
      description,
      category,
      occurredOn: resolveOccurredOn(dateModifier, now),
    });
  }

  return result;
}
