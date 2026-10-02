import { categorize, type LearnedCategories } from "../categories";
import { resolveOccurredOn, type DateModifier } from "../date/sao-paulo";
import type { ParsedTransaction, TransactionType } from "../types";
import { parseMoneyToCents } from "./parse-money";

const EXPENSE_VERBS = /\b(gastei|paguei|gasto|comprei)\b/g;
const INCOME_VERBS = /\b(recebi|ganhei)\b/g;
const CONNECTOR_WORDS = /\b(no|na|nos|nas|de|do|da|dos|das|em)\b/g;
const CURRENCY_WORDS = /\b(reais|real|conto|contos)\b/g;

function parseClause(
  rawClause: string,
  inheritedType: TransactionType,
  now: Date,
  learned: LearnedCategories,
): ParsedTransaction | null {
  let text = ` ${rawClause.toLowerCase().trim()} `;
  let type = inheritedType;

  // Regex com flag "g" reutilizada guarda posição entre chamadas (lastIndex) —
  // por isso o teste usa um literal novo a cada vez, e só o replace usa a constante global.
  if (/\b(gastei|paguei|gasto|comprei)\b/.test(text)) {
    type = "expense";
    text = text.replace(EXPENSE_VERBS, " ");
  } else if (/\b(recebi|ganhei)\b/.test(text)) {
    type = "income";
    text = text.replace(INCOME_VERBS, " ");
  }

  let dateModifier: DateModifier = "today";
  if (/\bontem\b/.test(text)) {
    dateModifier = "yesterday";
    text = text.replace(/\bontem\b/g, " ");
  } else {
    const diaMatch = text.match(/\bdia\s+(\d{1,2})\b/);
    if (diaMatch) {
      dateModifier = { day: Number.parseInt(diaMatch[1], 10) };
      text = text.replace(diaMatch[0], " ");
    }
  }

  text = text.replace(/r\$/g, " ");

  const amountMatch = text.match(/\d[\d.,]*/);
  if (!amountMatch || amountMatch.index === undefined) return null;

  const amountCents = parseMoneyToCents(amountMatch[0]);
  if (amountCents === null || amountCents <= 0) return null;

  text =
    text.slice(0, amountMatch.index) + " " + text.slice(amountMatch.index + amountMatch[0].length);

  text = text.replace(CURRENCY_WORDS, " ");
  text = text.replace(CONNECTOR_WORDS, " ");
  // Pontuação nas pontas ("ifood.", "mercado!") não faz parte da descrição: sem isso,
  // o termo aprendido numa correção ficaria com o ponto e nunca casaria com "ifood".
  const description =
    text
      .replace(/\s+/g, " ")
      .replace(/^[\s.,;:!?]+|[\s.,;:!?]+$/g, "")
      .trim() || null;

  const category = categorize(description ?? "", type, learned);
  const occurredOn = resolveOccurredOn(dateModifier, now);

  return { type, amountCents, description, category, occurredOn };
}

export function parseMessage(
  message: string,
  now: Date = new Date(),
  learned: LearnedCategories = {},
): ParsedTransaction[] | null {
  const rawClauses = message.split(/\s+e\s+/i);
  const clauses =
    rawClauses.length > 1 && rawClauses.every((clause) => /\d/.test(clause))
      ? rawClauses
      : [message];

  const results: ParsedTransaction[] = [];
  let inheritedType: TransactionType = "expense";

  for (const clause of clauses) {
    const parsed = parseClause(clause, inheritedType, now, learned);
    if (!parsed) return null;
    inheritedType = parsed.type;
    results.push(parsed);
  }

  return results;
}
