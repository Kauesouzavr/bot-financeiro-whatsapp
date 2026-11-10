import { describe, expect, it, vi } from "vitest";
import {
  CHAT_HISTORY_LIMIT,
  MAX_CHAT_MESSAGE_LENGTH,
  createChatService,
  type ChatDeps,
  type ChatMessage,
} from "@/core/chat/chat-service";
import type { CoreInput, CoreReply } from "@/core/types";
import { NOW } from "../../helpers/fake-deps";

function setup(options: { replies?: CoreReply[]; handleError?: Error } = {}) {
  const stored: { userId: string; role: string; text: string }[] = [];
  const handled: CoreInput[] = [];

  const deps: ChatDeps = {
    handleMessage: async (input) => {
      handled.push(input);
      if (options.handleError) throw options.handleError;
      return options.replies ?? [{ type: "text", text: "✅ R$ 45,00 em Delivery (ifood)" }];
    },
    listMessages: vi.fn(async (userId: string): Promise<ChatMessage[]> =>
      stored
        .filter((message) => message.userId === userId)
        .map((message, index) => ({
          id: `m-${index}`,
          role: message.role as ChatMessage["role"],
          text: message.text,
        })),
    ),
    appendMessages: async (userId, messages) => {
      for (const message of messages) stored.push({ userId, ...message });
    },
    clearMessages: async (userId) => {
      for (let i = stored.length - 1; i >= 0; i--)
        if (stored[i].userId === userId) stored.splice(i, 1);
    },
    getMonthTransactions: async () => [
      { type: "income", amountCents: 150000 },
      { type: "expense", amountCents: 4500 },
    ],
    now: () => NOW,
  };

  return { service: createChatService(deps), deps, stored, handled };
}

describe("createChatService: enviar mensagem", () => {
  it("manda o texto pro núcleo como entrada de texto e devolve a resposta e o saldo", async () => {
    const { service, handled } = setup();

    const result = await service.sendMessage("user-1", "gastei 45 no ifood");

    expect(handled).toEqual([
      { userId: "user-1", kind: "text", content: "gastei 45 no ifood", source: "text" },
    ]);
    expect(result).toEqual({
      ok: true,
      userText: "gastei 45 no ifood",
      botText: "✅ R$ 45,00 em Delivery (ifood)",
      balanceLine: "Setembro: entrou R$ 1.500,00 · saiu R$ 45,00 · saldo R$ 1.455,00",
    });
  });

  it("guarda a mensagem da pessoa e a resposta do bot, nessa ordem", async () => {
    const { service, stored } = setup();

    await service.sendMessage("user-1", "gastei 45 no ifood");

    expect(stored).toEqual([
      { userId: "user-1", role: "user", text: "gastei 45 no ifood" },
      { userId: "user-1", role: "bot", text: "✅ R$ 45,00 em Delivery (ifood)" },
    ]);
  });

  it("junta várias respostas do núcleo num texto só", async () => {
    const { service } = setup({
      replies: [
        { type: "text", text: "primeira" },
        { type: "text", text: "segunda" },
      ],
    });

    const result = await service.sendMessage("user-1", "x 10");

    expect(result).toMatchObject({ ok: true, botText: "primeira\n\nsegunda" });
  });

  it("apara espaços antes de usar o texto", async () => {
    const { service, handled } = setup();

    await service.sendMessage("user-1", "   gastei 45 no ifood  \n");

    expect(handled[0].content).toBe("gastei 45 no ifood");
  });

  it("recusa mensagem vazia sem chamar o núcleo nem guardar nada", async () => {
    const { service, handled, stored } = setup();

    expect(await service.sendMessage("user-1", "   ")).toEqual({
      ok: false,
      error: "Escreva uma mensagem.",
    });
    expect(handled).toHaveLength(0);
    expect(stored).toHaveLength(0);
  });

  it("recusa mensagem acima do limite, mas aceita a exatamente no limite", async () => {
    const { service, handled } = setup();

    const tooLong = await service.sendMessage("user-1", "a".repeat(MAX_CHAT_MESSAGE_LENGTH + 1));
    expect(tooLong).toEqual({
      ok: false,
      error: `Mensagem muito longa. Mande até ${MAX_CHAT_MESSAGE_LENGTH} caracteres.`,
    });
    expect(handled).toHaveLength(0);

    const atLimit = await service.sendMessage("user-1", "a".repeat(MAX_CHAT_MESSAGE_LENGTH));
    expect(atLimit.ok).toBe(true);
    expect(handled).toHaveLength(1);
  });

  it("se o núcleo falhar, devolve erro genérico e não guarda nada no histórico", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { service, stored } = setup({
      handleError: new Error("banco caiu: gastei 999 no segredo"),
    });

    const result = await service.sendMessage("user-1", "gastei 999 no segredo");

    expect(result).toEqual({
      ok: false,
      error: "Não consegui processar agora. Tente de novo em instantes.",
    });
    expect(stored).toHaveLength(0);
    // O log tem só o tipo do erro, nunca o texto da mensagem nem o texto do erro.
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("segredo");
    errorSpy.mockRestore();
  });
});

describe("createChatService: carregar e limpar", () => {
  it("carrega o histórico da pessoa e o saldo do mês", async () => {
    const { service, deps } = setup();
    await service.sendMessage("user-1", "gastei 45 no ifood");

    const view = await service.loadChat("user-1");

    expect(view.messages.map((message) => message.role)).toEqual(["user", "bot"]);
    expect(view.balanceLine).toContain("Setembro");
    expect(deps.listMessages).toHaveBeenCalledWith("user-1", CHAT_HISTORY_LIMIT);
  });

  it("cada pessoa só enxerga o próprio histórico", async () => {
    const { service } = setup();
    await service.sendMessage("user-1", "gastei 45 no ifood");

    const other = await service.loadChat("user-2");

    expect(other.messages).toEqual([]);
  });

  it("limpar apaga só a conversa de quem pediu", async () => {
    const { service } = setup();
    await service.sendMessage("user-1", "gastei 45 no ifood");
    await service.sendMessage("user-2", "recebi 1500 salário");

    await service.clear("user-1");

    expect((await service.loadChat("user-1")).messages).toEqual([]);
    expect((await service.loadChat("user-2")).messages).toHaveLength(2);
  });
});
