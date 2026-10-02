import { describe, expect, it } from "vitest";
import { createMessageHandler, type CoreDeps } from "@/core/message-handler";
import type { CoreInput, ParsedTransaction } from "@/core/types";

// Terça, 2026-09-15 (meio-dia em SP). Fixa pra "setembro" e "ontem" não dependerem do dia do teste.
const NOW = new Date("2026-09-15T15:00:00Z");

function createFakeDeps() {
  const stored: ParsedTransaction[] = [];

  const deps: CoreDeps = {
    insertTransactions: async (_userId, transactions) => {
      stored.push(...transactions);
    },
    getMonthTransactions: async () =>
      stored.map((transaction) => ({
        type: transaction.type,
        amountCents: transaction.amountCents,
      })),
    now: () => NOW,
  };

  return { deps, stored };
}

function textInput(content: string): CoreInput {
  return { userId: "user-1", kind: "text", content, source: "simulator" };
}

describe("createMessageHandler", () => {
  it("registra a transação e responde com a confirmação e o saldo do mês", async () => {
    const { deps, stored } = createFakeDeps();
    const handle = createMessageHandler(deps);

    const replies = await handle(textInput("gastei 45 no ifood"));

    expect(stored).toHaveLength(1);
    expect(replies).toHaveLength(1);
    expect(replies[0].text).toBe(
      "✅ R$ 45,00 em Delivery (ifood)\nSetembro: entrou R$ 0,00 · saiu R$ 45,00 · saldo -R$ 45,00",
    );
  });

  it("junta várias transações da mesma mensagem em uma resposta só", async () => {
    const { deps, stored } = createFakeDeps();
    const handle = createMessageHandler(deps);

    const replies = await handle(textInput("gastei 45 no ifood e 12 no uber"));

    expect(stored).toHaveLength(2);
    expect(replies).toHaveLength(1);
    expect(replies[0].text.split("\n")).toHaveLength(3);
  });

  it("pede pra reformular, sem gravar nada, quando não entende", async () => {
    const { deps, stored } = createFakeDeps();
    const handle = createMessageHandler(deps);

    const replies = await handle(textInput("bom dia"));

    expect(stored).toHaveLength(0);
    expect(replies[0].text).toContain("Não entendi");
  });

  it("avisa que só entende texto quando chega outro tipo de mensagem", async () => {
    const { deps, stored } = createFakeDeps();
    const handle = createMessageHandler(deps);

    const replies = await handle({ userId: "user-1", kind: "audio", content: "x", source: "text" });

    expect(stored).toHaveLength(0);
    expect(replies[0].text).toContain("só entendo mensagens de texto");
  });
});
