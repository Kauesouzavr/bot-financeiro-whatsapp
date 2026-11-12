import { parseMoneyToCents } from "../parser/parse-money";

export type BudgetCommand =
  | { kind: "set_budget"; categoryText: string; amountCents: number }
  | { kind: "remove_budget"; categoryText: string }
  | { kind: "list_budgets" };

export type Command =
  { kind: "change_category"; categoryText: string } | { kind: "delete_last" } | BudgetCommand;

// "muda pra lazer", "troca para Alimentação", "altera a categoria pra mercado"
const CHANGE_CATEGORY =
  /^(?:muda|mudar|troca|trocar|altera|alterar)(?:\s+a\s+categoria)?\s+(?:pra|para)\s+(.+)$/i;

// "apaga o último", "remove a última entrada", "desfaz o último gasto".
// Exige "último/última" de propósito: "apaga" sozinho poderia apagar sem querer.
const DELETE_LAST =
  /^(?:apaga|apagar|remove|remover|exclui|excluir|deleta|deletar|desfaz|desfazer)\s+(?:o\s+|a\s+)?[uú]ltim[oa](?:\s+(?:registro|gasto|lan[cç]amento|transa[cç][aã]o|entrada))?$/i;

// "orçamento delivery 300", "limite de mercado 800,50", "orçamento pra lazer R$ 1.200 reais".
// O valor tem que ser a última coisa da frase, pra "limite de mercado" sozinho não virar comando.
const SET_BUDGET =
  /^(?:or[cç]amento|limite)\s+(?:(?:de|do|da|pra|para)\s+)?(.+?)\s+(?:R\$\s*)?(\d[\d.,]*)(?:\s*(?:reais|real|conto|contos))?$/i;

// "tira o orçamento de delivery", "apaga o limite do mercado", "cancela orçamento lazer".
const REMOVE_BUDGET =
  /^(?:tira|tirar|remove|remover|apaga|apagar|exclui|excluir|deleta|deletar|cancela|cancelar)\s+(?:o\s+)?(?:or[cç]amento|limite)\s+(?:(?:de|do|da)\s+)?(.+)$/i;

// "meus orçamentos", "orçamentos", "ver orçamentos", "mostra os limites", "lista meus orçamentos".
const LIST_BUDGETS =
  /^(?:(?:ver|mostra|mostrar|lista|listar)\s+)?(?:(?:meus|os)\s+)?(?:or[cç]amentos?|limites)$/i;

export function parseCommand(message: string): Command | null {
  const text = message
    .trim()
    .replace(/[.!?,;:\s]+$/, "")
    .replace(/\s+/g, " ");

  const change = CHANGE_CATEGORY.exec(text);
  if (change) return { kind: "change_category", categoryText: change[1].trim() };

  if (DELETE_LAST.test(text)) return { kind: "delete_last" };

  const setBudget = SET_BUDGET.exec(text);
  if (setBudget) {
    const amountCents = parseMoneyToCents(setBudget[2]);
    // Valor que não dá pra ler (ex.: ",,") não é comando: segue pro fluxo normal e pede pra reformular.
    if (amountCents === null) return null;
    return { kind: "set_budget", categoryText: setBudget[1].trim(), amountCents };
  }

  const removeBudget = REMOVE_BUDGET.exec(text);
  if (removeBudget) return { kind: "remove_budget", categoryText: removeBudget[1].trim() };

  if (LIST_BUDGETS.test(text)) return { kind: "list_budgets" };

  return null;
}
