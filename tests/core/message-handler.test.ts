import { describe, expect, it } from "vitest";
import type { AiExtraction } from "@/core/ai/extraction";
import { createMessageHandler } from "@/core/message-handler";
import type { CoreInput } from "@/core/types";
import { createFakeStore } from "../helpers/fake-deps";

function textInput(content: string): CoreInput {
  return { userId: "user-1", kind: "text", content, source: "simulator" };
}

function setup(initialLearned: Record<string, string> = {}) {
  const store = createFakeStore(initialLearned);
  const handle = createMessageHandler(store.deps);
  return { ...store, handle };
}

describe("createMessageHandler: registro", () => {
  it("registra a transação e responde com a confirmação e o saldo do mês", async () => {
    const { handle, transactions } = setup();

    const replies = await handle(textInput("gastei 45 no ifood"));

    expect(transactions).toHaveLength(1);
    expect(replies).toHaveLength(1);
    expect(replies[0].text).toBe(
      "✅ R$ 45,00 em Delivery (ifood)\nSetembro: entrou R$ 0,00 · saiu R$ 45,00 · saldo -R$ 45,00",
    );
  });

  it("junta várias transações da mesma mensagem em uma resposta só", async () => {
    const { handle, transactions } = setup();

    const replies = await handle(textInput("gastei 45 no ifood e 12 no uber"));

    expect(transactions).toHaveLength(2);
    expect(replies).toHaveLength(1);
    expect(replies[0].text.split("\n")).toHaveLength(3);
  });

  it("usa a categoria que o usuário já ensinou", async () => {
    const { handle, transactions } = setup({ ifood: "Lazer" });

    const replies = await handle(textInput("gastei 45 no ifood"));

    expect(transactions[0].category).toBe("Lazer");
    expect(replies[0].text).toContain("✅ R$ 45,00 em Lazer (ifood)");
  });

  it("pede pra reformular, sem gravar nada, quando não entende", async () => {
    const { handle, transactions } = setup();

    const replies = await handle(textInput("bom dia"));

    expect(transactions).toHaveLength(0);
    expect(replies[0].text).toContain("Não entendi");
  });

  it("avisa que só entende texto quando chega outro tipo de mensagem", async () => {
    const { handle, transactions } = setup();

    const replies = await handle({ userId: "user-1", kind: "audio", content: "x", source: "text" });

    expect(transactions).toHaveLength(0);
    expect(replies[0].text).toContain("só entendo mensagens de texto");
  });
});

describe("createMessageHandler: IA de reserva", () => {
  const RACAO: AiExtraction = {
    transactions: [
      {
        type: "expense",
        amount: "89,90",
        description: "ração do cachorro",
        date: "today",
        day_of_month: null,
        category: "Compras",
      },
    ],
  };

  it("não chama a IA quando o parser por regras entende", async () => {
    const { handle, ai } = setup();

    await handle(textInput("gastei 45 no ifood"));

    expect(ai.calls).toHaveLength(0);
  });

  it("não chama a IA para comandos", async () => {
    const { handle, ai } = setup();
    await handle(textInput("gastei 45 no ifood"));

    await handle(textInput("muda pra lazer"));
    await handle(textInput("apaga o último"));

    expect(ai.calls).toHaveLength(0);
  });

  it("chama a IA quando o parser falha e grava o que ela extraiu", async () => {
    const { handle, ai, transactions } = setup();
    ai.result = RACAO;

    const replies = await handle(textInput("comprei ração pro cachorro por oitenta e nove reais"));

    expect(ai.calls).toEqual(["comprei ração pro cachorro por oitenta e nove reais"]);
    expect(transactions).toHaveLength(1);
    expect(replies[0].text).toBe(
      "✅ R$ 89,90 em Compras (ração do cachorro)\nSetembro: entrou R$ 0,00 · saiu R$ 89,90 · saldo -R$ 89,90",
    );
  });

  it("aplica as categorias aprendidas também nas transações vindas da IA", async () => {
    const { handle, ai, transactions } = setup({ "ração do cachorro": "Lazer" });
    ai.result = RACAO;

    await handle(textInput("comprei ração pro cachorro por oitenta e nove reais"));

    expect(transactions[0].category).toBe("Lazer");
  });

  it("pede pra reformular, sem gravar, quando a IA falha ou não acha nada", async () => {
    const { handle, ai, transactions } = setup();

    ai.result = null;
    const failed = await handle(textInput("blá blá"));
    ai.result = { transactions: [] };
    const empty = await handle(textInput("bom dia"));

    expect(transactions).toHaveLength(0);
    expect(failed[0].text).toContain("Não entendi");
    expect(empty[0].text).toContain("Não entendi");
  });
});

describe("createMessageHandler: muda pra X", () => {
  it("troca a categoria da última transação e avisa o que vai lembrar", async () => {
    const { handle, transactions } = setup();
    await handle(textInput("gastei 45 no ifood"));

    const replies = await handle(textInput("muda pra lazer"));

    expect(transactions[0].category).toBe("Lazer");
    expect(replies).toHaveLength(1);
    expect(replies[0].text).toBe(
      '✏️ Pronto! R$ 45,00 (ifood) agora é Lazer.\nDa próxima vez, "ifood" já entra como Lazer.',
    );
  });

  it("a correção vale pras próximas mensagens do mesmo termo", async () => {
    const { handle, transactions, learned } = setup();
    await handle(textInput("gastei 45 no ifood"));
    await handle(textInput("muda pra lazer"));

    await handle(textInput("gastei 20 no ifood"));

    expect(learned).toEqual({ ifood: "Lazer" });
    expect(transactions[1].category).toBe("Lazer");
  });

  it("mexe só na última transação, mesmo quando a mensagem tinha várias", async () => {
    const { handle, transactions } = setup();
    await handle(textInput("gastei 45 no ifood e 12 no uber"));

    await handle(textInput("muda pra lazer"));

    expect(transactions.map((transaction) => transaction.category)).toEqual(["Delivery", "Lazer"]);
  });

  it("corrige sem aprender quando a transação não tem descrição", async () => {
    const { handle, transactions, learned } = setup();
    await handle(textInput("gastei 45"));

    const replies = await handle(textInput("muda pra lazer"));

    expect(transactions[0].category).toBe("Lazer");
    expect(learned).toEqual({});
    expect(replies[0].text).toBe("✏️ Pronto! R$ 45,00 agora é Lazer.");
  });

  it("lista as categorias quando não conhece a pedida, sem alterar nada", async () => {
    const { handle, transactions, learned } = setup();
    await handle(textInput("gastei 45 no ifood"));

    const replies = await handle(textInput("muda pra viagens"));

    expect(transactions[0].category).toBe("Delivery");
    expect(learned).toEqual({});
    expect(replies[0].text).toContain('Não conheço a categoria "viagens"');
    expect(replies[0].text).toContain("Alimentação, Delivery");
  });

  it("não aceita categoria de saída numa entrada", async () => {
    const { handle, transactions } = setup();
    await handle(textInput("recebi 1500 salário"));

    const replies = await handle(textInput("muda pra lazer"));

    expect(transactions[0].category).toBe("Salário");
    expect(replies[0].text).toContain("Pra entradas eu tenho: Salário, Freela");
  });

  it("avisa quando ainda não há nenhum registro", async () => {
    const { handle } = setup();

    const replies = await handle(textInput("muda pra lazer"));

    expect(replies[0].text).toContain("ainda não tem nenhum registro");
  });
});

describe("createMessageHandler: apaga o último", () => {
  it("apaga só a última transação e mostra o saldo atualizado", async () => {
    const { handle, transactions } = setup();
    await handle(textInput("recebi 1500 salário"));
    await handle(textInput("gastei 45 no ifood"));

    const replies = await handle(textInput("apaga o último"));

    expect(transactions).toHaveLength(1);
    expect(transactions[0].category).toBe("Salário");
    expect(replies[0].text).toBe(
      "🗑️ Apaguei: R$ 45,00 em Delivery (ifood)\nSetembro: entrou R$ 1.500,00 · saiu R$ 0,00 · saldo R$ 1.500,00",
    );
  });

  it("apagar de novo apaga a anterior; depois disso não sobra nada", async () => {
    const { handle, transactions } = setup();
    await handle(textInput("gastei 45 no ifood"));
    await handle(textInput("gastei 12 no uber"));

    await handle(textInput("apaga o último"));
    await handle(textInput("apaga o último"));
    const replies = await handle(textInput("apaga o último"));

    expect(transactions).toHaveLength(0);
    expect(replies[0].text).toContain("ainda não tem nenhum registro");
  });
});
