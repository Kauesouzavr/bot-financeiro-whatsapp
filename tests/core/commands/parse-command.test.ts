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
  ])('ignora "%s"', (message) => {
    expect(parseCommand(message)).toBeNull();
  });
});
