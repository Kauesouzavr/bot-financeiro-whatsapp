import { describe, expect, it, vi } from "vitest";
import type { Budget } from "@/core/budgets/budget-status";
import { createMessageHandler } from "@/core/message-handler";
import type { CoreInput } from "@/core/types";
import { createFakeStore } from "../helpers/fake-deps";

function textInput(content: string): CoreInput {
  return { userId: "user-1", kind: "text", content, source: "simulator" };
}

function setup(initialBudgets: Budget[] = []) {
  const store = createFakeStore({}, initialBudgets);
  const handle = createMessageHandler(store.deps);
  return { ...store, handle };
}

describe("comandos de orçamento", () => {
  it("define o orçamento e mostra como o mês está", async () => {
    const { handle, budgets, transactions } = setup();
    await handle(textInput("gastei 210 no ifood"));

    const replies = await handle(textInput("orçamento delivery 300"));

    expect(budgets).toEqual([{ category: "Delivery", limitCents: 30000 }]);
    expect(transactions).toHaveLength(1); // o comando não registra nenhuma transação
    expect(replies).toHaveLength(1);
    expect(replies[0].text).toBe(
      "🎯 Orçamento de Delivery: R$ 300,00 por mês.\nNeste mês: R$ 210,00 (70%).",
    );
  });

  it("definir de novo troca o valor em vez de criar outro orçamento", async () => {
    const { handle, budgets } = setup();

    await handle(textInput("orçamento delivery 300"));
    await handle(textInput("limite de delivery 450,50"));

    expect(budgets).toEqual([{ category: "Delivery", limitCents: 45050 }]);
  });

  it("entende a categoria com ou sem acento e com maiúsculas", async () => {
    const { handle, budgets } = setup();

    await handle(textInput("Orçamento ALIMENTACAO 800"));

    expect(budgets).toEqual([{ category: "Alimentação", limitCents: 80000 }]);
  });

  it("não cria orçamento para categoria desconhecida nem para categoria de entrada", async () => {
    const { handle, budgets } = setup();

    const unknown = await handle(textInput("orçamento pets 100"));
    const income = await handle(textInput("orçamento salário 100"));

    expect(budgets).toEqual([]);
    expect(unknown[0].text).toContain('Não conheço a categoria "pets"');
    expect(income[0].text).toContain('Não conheço a categoria "salário"');
  });

  it("recusa valor zero e valor alto demais sem gravar nada", async () => {
    const { handle, budgets } = setup();

    const zero = await handle(textInput("orçamento delivery 0"));
    const huge = await handle(textInput("orçamento delivery 99999999"));

    expect(budgets).toEqual([]);
    expect(zero[0].text).toContain("maior que zero");
    expect(huge[0].text).toContain("alto demais");
  });

  it("lista os orçamentos do mês, os mais apertados primeiro", async () => {
    const { handle } = setup([
      { category: "Mercado", limitCents: 100000 },
      { category: "Delivery", limitCents: 30000 },
    ]);
    await handle(textInput("gastei 270 no ifood"));
    await handle(textInput("gastei 100 no mercado"));

    const replies = await handle(textInput("meus orçamentos"));

    expect(replies[0].text.split("\n")).toEqual([
      "🎯 Orçamentos de Setembro de 2026:",
      "• ⚠️ Delivery: R$ 270,00 de R$ 300,00 (90%)",
      "• Mercado: R$ 100,00 de R$ 1.000,00 (10%)",
    ]);
  });

  it("explica como criar o primeiro quando não há nenhum", async () => {
    const { handle } = setup();

    const replies = await handle(textInput("meus orçamentos"));

    expect(replies[0].text).toContain("orçamento delivery 300");
  });

  it("remove o orçamento e avisa quando ele não existe", async () => {
    const { handle, budgets } = setup([{ category: "Delivery", limitCents: 30000 }]);

    const removed = await handle(textInput("tira o orçamento de delivery"));
    const again = await handle(textInput("tira o orçamento de delivery"));

    expect(budgets).toEqual([]);
    expect(removed[0].text).toBe("🗑️ Orçamento de Delivery removido.");
    expect(again[0].text).toBe("Você não tem orçamento em Delivery.");
  });

  it("não confunde com 'apaga o último': remover orçamento não apaga transação", async () => {
    const { handle, transactions } = setup([{ category: "Delivery", limitCents: 30000 }]);
    await handle(textInput("gastei 45 no ifood"));

    await handle(textInput("apaga o limite de delivery"));

    expect(transactions).toHaveLength(1);
  });

  it("funciona mesmo sem nenhuma transação registrada", async () => {
    const { handle } = setup();

    const replies = await handle(textInput("orçamento mercado 500"));

    expect(replies[0].text).toContain("🎯 Orçamento de Mercado");
  });
});

describe("aviso de orçamento ao registrar um gasto", () => {
  it("junta o aviso na mesma resposta, entre a confirmação e o saldo", async () => {
    const { handle } = setup([{ category: "Delivery", limitCents: 30000 }]);

    const replies = await handle(textInput("gastei 270 no ifood"));

    expect(replies).toHaveLength(1);
    expect(replies[0].text.split("\n")).toEqual([
      "✅ R$ 270,00 em Delivery (ifood)",
      "⚠️ Delivery: R$ 270,00 de R$ 300,00 (90%)",
      "Setembro: entrou R$ 0,00 · saiu R$ 270,00 · saldo -R$ 270,00",
    ]);
  });

  it("avisa que estourou e quanto passou", async () => {
    const { handle } = setup([{ category: "Delivery", limitCents: 30000 }]);
    await handle(textInput("gastei 270 no ifood"));

    const replies = await handle(textInput("gastei 50 no ifood"));

    expect(replies[0].text).toContain("🚨 Delivery: R$ 320,00 de R$ 300,00 · passou R$ 20,00");
  });

  it("fica quieto enquanto o gasto cabe folgado no orçamento", async () => {
    const { handle } = setup([{ category: "Delivery", limitCents: 30000 }]);

    const replies = await handle(textInput("gastei 45 no ifood"));

    expect(replies[0].text.split("\n")).toHaveLength(2);
  });

  it("não avisa de outras categorias nem de entradas", async () => {
    const { handle } = setup([{ category: "Delivery", limitCents: 100 }]);
    await handle(textInput("gastei 45 no ifood"));

    const uber = await handle(textInput("gastei 12 no uber"));
    const salary = await handle(textInput("recebi 1500 salário"));

    expect(uber[0].text.split("\n")).toHaveLength(2);
    expect(salary[0].text.split("\n")).toHaveLength(2);
  });

  it("uma mensagem com vários gastos gera uma resposta só, com um aviso por categoria apertada", async () => {
    const { handle } = setup([
      { category: "Delivery", limitCents: 4000 },
      { category: "Transporte", limitCents: 1500 },
    ]);

    const replies = await handle(textInput("gastei 45 no ifood e 12 no uber"));

    expect(replies).toHaveLength(1);
    expect(replies[0].text.split("\n")).toEqual([
      "✅ R$ 45,00 em Delivery (ifood)",
      "✅ R$ 12,00 em Transporte (uber)",
      "🚨 Delivery: R$ 45,00 de R$ 40,00 · passou R$ 5,00",
      "⚠️ Transporte: R$ 12,00 de R$ 15,00 (80%)",
      "Setembro: entrou R$ 0,00 · saiu R$ 57,00 · saldo -R$ 57,00",
    ]);
  });

  it("se os orçamentos não puderem ser lidos, o gasto é registrado e a resposta sai normal", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handle, transactions, failures } = setup([{ category: "Delivery", limitCents: 100 }]);
    failures.getBudgets = new Error("relation does not exist");

    const replies = await handle(textInput("gastei 45 no ifood"));

    expect(transactions).toHaveLength(1);
    expect(replies[0].text).toBe(
      "✅ R$ 45,00 em Delivery (ifood)\nSetembro: entrou R$ 0,00 · saiu R$ 45,00 · saldo -R$ 45,00",
    );
    errorSpy.mockRestore();
  });
});
