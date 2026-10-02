export type Command = { kind: "change_category"; categoryText: string } | { kind: "delete_last" };

// "muda pra lazer", "troca para Alimentação", "altera a categoria pra mercado"
const CHANGE_CATEGORY =
  /^(?:muda|mudar|troca|trocar|altera|alterar)(?:\s+a\s+categoria)?\s+(?:pra|para)\s+(.+)$/i;

// "apaga o último", "remove a última entrada", "desfaz o último gasto".
// Exige "último/última" de propósito: "apaga" sozinho poderia apagar sem querer.
const DELETE_LAST =
  /^(?:apaga|apagar|remove|remover|exclui|excluir|deleta|deletar|desfaz|desfazer)\s+(?:o\s+|a\s+)?[uú]ltim[oa](?:\s+(?:registro|gasto|lan[cç]amento|transa[cç][aã]o|entrada))?$/i;

export function parseCommand(message: string): Command | null {
  const text = message
    .trim()
    .replace(/[.!?,;:\s]+$/, "")
    .replace(/\s+/g, " ");

  const change = CHANGE_CATEGORY.exec(text);
  if (change) return { kind: "change_category", categoryText: change[1].trim() };

  if (DELETE_LAST.test(text)) return { kind: "delete_last" };

  return null;
}
