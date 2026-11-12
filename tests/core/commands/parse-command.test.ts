import { describe, expect, it } from "vitest";
import { parseCommand } from "@/core/commands/parse-command";

describe("parseCommand: mudar categoria", () => {
  it.each([
    ["muda pra lazer", "lazer"],
    ["Muda para Lazer", "Lazer"],
    ["mudar pra alimentação", "alimentação"],
    ["troca pra mercado", "mercado"],
    ["altera a categoria pra transporte", "transporte"],
    ["  muda pra lazer!  ", "lazer"],
    ["muda pra pix recebido", "pix recebido"],
  ])('entende "%s"', (message, categoryText) => {
    expect(parseCommand(message)).toEqual({ kind: "change_category", categoryText });
  });
});

describe("parseCommand: apagar o último", () => {
  it.each([
    "apaga o último",
    "Apaga o ultimo",
    "apagar o último",
    "remove a última entrada",
    "exclui o último gasto",
    "desfaz o último registro",
    "apaga o último lançamento.",
  ])('entende "%s"', (message) => {
    expect(parseCommand(message)).toEqual({ kind: "delete_last" });
  });
});

describe("parseCommand: definir orçamento", () => {
  it.each([
    ["orçamento delivery 300", "delivery", 30000],
    ["Orçamento Delivery 300", "Delivery", 30000],
    ["orcamento delivery 300", "delivery", 30000],
    ["limite de mercado 800", "mercado", 80000],
    ["limite do mercado 800,50", "mercado", 80050],
    ["orçamento pra lazer R$ 1.200", "lazer", 120000],
    ["orçamento para alimentação 450 reais", "alimentação", 45000],
    ["orçamento de transporte R$ 99,90.", "transporte", 9990],
    ["  limite de assinaturas 60!  ", "assinaturas", 6000],
  ])('entende "%s"', (message, categoryText, amountCents) => {
    expect(parseCommand(message)).toEqual({ kind: "set_budget", categoryText, amountCents });
  });

  it("deixa o valor zero chegar ao núcleo, que responde que precisa ser maior que zero", () => {
    expect(parseCommand("orçamento delivery 0")).toEqual({
      kind: "set_budget",
      categoryText: "delivery",
      amountCents: 0,
    });
  });
});

describe("parseCommand: remover orçamento", () => {
  it.each([
    ["tira o orçamento de delivery", "delivery"],
    ["Remove o orçamento do mercado", "mercado"],
    ["apaga o limite da alimentação", "alimentação"],
    ["cancela orçamento lazer", "lazer"],
    ["exclui o orçamento de transporte.", "transporte"],
  ])('entende "%s"', (message, categoryText) => {
    expect(parseCommand(message)).toEqual({ kind: "remove_budget", categoryText });
  });
});

describe("parseCommand: listar orçamentos", () => {
  it.each([
    "meus orçamentos",
    "Meus Orçamentos",
    "orçamentos",
    "orçamento",
    "ver orçamentos",
    "mostra os limites",
    "lista meus orçamentos",
    "meus orcamentos?",
  ])('entende "%s"', (message) => {
    expect(parseCommand(message)).toEqual({ kind: "list_budgets" });
  });
});

describe("parseCommand: o que NÃO é comando", () => {
  it.each([
    "gastei 45 no ifood",
    "apaga",
    "apaga tudo",
    "apaga o penúltimo",
    "muda",
    "muda pra",
    "gastei 30 pra lazer",
    "bom dia",
    "",
    "orçamento delivery",
    "orçamento 300",
    "limite",
    "limite de mercado",
    "gastei 50 no orçamento",
    "tira o orçamento",
    "apaga o último orçamento",
  ])('ignora "%s"', (message) => {
    expect(parseCommand(message)).toBeNull();
  });
});
