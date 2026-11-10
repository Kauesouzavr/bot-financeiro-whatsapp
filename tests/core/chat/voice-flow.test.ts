import { describe, expect, it, vi } from "vitest";
import { VOICE_MAX_BYTES, VOICE_MESSAGES, VOICE_USER_TEXT } from "@/core/ai/voice";
import {
  MAX_CHAT_MESSAGE_LENGTH,
  createChatService,
  type AudioFile,
} from "@/core/chat/chat-service";
import { createMessageHandler } from "@/core/message-handler";
import type { TransactionSource } from "@/core/types";
import { createFakeStore } from "../../helpers/fake-deps";
import { createFakeChat, type FakeChatOptions } from "../../helpers/fake-chat";

function audio(overrides: Partial<AudioFile> = {}): AudioFile {
  return { mimeType: "audio/mp4", bytes: new Uint8Array([0, 0, 0, 0x1c, 1, 2, 3]), ...overrides };
}

function setup(options: FakeChatOptions = {}) {
  return createFakeChat(options);
}

describe("sendVoice", () => {
  it("transcreve e entrega o texto ao núcleo como uma mensagem de texto de origem 'audio'", async () => {
    const { service, handled } = setup({ transcript: "gastei 30 reais no mercado" });

    const result = await service.sendVoice("user-1", audio());

    expect(result.ok).toBe(true);
    expect(handled).toEqual([
      { userId: "user-1", kind: "text", content: "gastei 30 reais no mercado", source: "audio" },
    ]);
  });

  it("a resposta mostra o que foi entendido, seguido da resposta de sempre e do saldo", async () => {
    const { service } = setup({
      transcript: "gastei 30 reais no mercado",
      replies: [{ type: "text", text: "✅ R$ 30,00 em Mercado" }],
    });

    const result = await service.sendVoice("user-1", audio());

    expect(result).toEqual({
      ok: true,
      userText: VOICE_USER_TEXT,
      botText: '🎙️ Entendi: "gastei 30 reais no mercado"\n✅ R$ 30,00 em Mercado',
      balanceLine: expect.stringContaining("saldo"),
    });
  });

  it("guarda no histórico só texto: o balão de voz e a resposta (nunca o áudio)", async () => {
    const { service, stored } = setup();

    await service.sendVoice("user-1", audio());

    expect(stored.map((message) => message.role)).toEqual(["user", "bot"]);
    expect(stored[0].text).toBe(VOICE_USER_TEXT);
    expect(stored[1].text).toContain("Entendi");
    expect(JSON.stringify(stored)).not.toContain("audio/mp4");
  });

  it("manda o áudio pra transcrição exatamente como veio", async () => {
    const { service, transcribed } = setup();
    const recording = audio({ mimeType: "audio/webm", bytes: new Uint8Array([0x1a, 0x45, 0xdf]) });

    await service.sendVoice("user-1", recording);

    expect(transcribed).toEqual([recording]);
  });

  it.each([
    ["tipo não aceito", audio({ mimeType: "text/html" as AudioFile["mimeType"] })],
    ["arquivo vazio", audio({ bytes: new Uint8Array() })],
    ["arquivo grande demais", audio({ bytes: new Uint8Array(VOICE_MAX_BYTES + 1) })],
  ])("recusa %s sem chamar a IA nem o núcleo", async (_label, bad) => {
    const { service, transcribed, handled, stored } = setup();

    const result = await service.sendVoice("user-1", bad);

    expect(result).toEqual({ ok: false, error: VOICE_MESSAGES.invalidFile });
    expect(transcribed).toHaveLength(0);
    expect(handled).toHaveLength(0);
    expect(stored).toHaveLength(0);
  });

  it("aceita arquivo exatamente no limite de tamanho", async () => {
    const { service } = setup();

    const result = await service.sendVoice(
      "user-1",
      audio({ bytes: new Uint8Array(VOICE_MAX_BYTES) }),
    );

    expect(result.ok).toBe(true);
  });

  it("se a IA falha (null), avisa e não grava nada", async () => {
    const { service, handled, stored, inserted } = setup({ transcript: null });

    const result = await service.sendVoice("user-1", audio());

    expect(result).toEqual({ ok: false, error: VOICE_MESSAGES.failed });
    expect(handled).toHaveLength(0);
    expect(stored).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });

  it.each([
    ["vazio", ""],
    ["só espaços", "   \n "],
  ])(
    "se não havia fala (%s), diz que não ouviu e não chama o núcleo",
    async (_label, transcript) => {
      const { service, handled, stored } = setup({ transcript });

      const result = await service.sendVoice("user-1", audio());

      expect(result).toEqual({ ok: false, error: VOICE_MESSAGES.noSpeech });
      expect(handled).toHaveLength(0);
      expect(stored).toHaveLength(0);
    },
  );

  it("recusa texto maior que o limite do chat, mas aceita exatamente no limite", async () => {
    const tooLong = setup({ transcript: "a".repeat(MAX_CHAT_MESSAGE_LENGTH + 1) });
    expect(await tooLong.service.sendVoice("user-1", audio())).toEqual({
      ok: false,
      error: VOICE_MESSAGES.tooLong,
    });
    expect(tooLong.handled).toHaveLength(0);

    const exact = setup({ transcript: "a".repeat(MAX_CHAT_MESSAGE_LENGTH) });
    expect((await exact.service.sendVoice("user-1", audio())).ok).toBe(true);
  });

  it("tira os espaços das pontas do texto antes de entregar ao núcleo", async () => {
    const { service, handled } = setup({ transcript: "  gastei 30 no mercado\n" });

    await service.sendVoice("user-1", audio());

    expect(handled[0].content).toBe("gastei 30 no mercado");
  });

  it("se o núcleo der erro, devolve mensagem amigável, não guarda nada e não loga o que foi dito", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { service, stored } = setup({
      transcript: "gastei 777 no segredo",
      handleError: new Error("banco fora do ar: gastei 777 no segredo"),
    });

    const result = await service.sendVoice("user-1", audio());

    expect(result).toEqual({
      ok: false,
      error: "Não consegui processar agora. Tente de novo em instantes.",
    });
    expect(stored).toHaveLength(0);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("777");
    errorSpy.mockRestore();
  });
});

describe("sendVoice com o núcleo de verdade", () => {
  // Liga o chat ao mesmo núcleo do texto, com um banco em memória que também anota a origem.
  function withRealCore() {
    const store = createFakeStore();
    const sources: TransactionSource[] = [];
    const core = createMessageHandler({
      ...store.deps,
      insertTransactions: async (userId, transactions, source) => {
        sources.push(source);
        await store.deps.insertTransactions(userId, transactions, source);
      },
    });
    const fake = createFakeChat({ transcript: "gastei 30 reais no mercado" });
    const service = createChatService({ ...fake.deps, handleMessage: core });
    return { service, fake, store, sources };
  }

  it('"gastei 30 reais no mercado" falado vira uma transação em Mercado, com origem audio', async () => {
    const { service, store, sources } = withRealCore();

    const result = await service.sendVoice("user-1", audio());

    expect(result.ok).toBe(true);
    expect(store.transactions).toHaveLength(1);
    expect(store.transactions[0]).toMatchObject({
      type: "expense",
      amountCents: 3000,
      category: "Mercado",
    });
    expect(sources).toEqual(["audio"]);
    if (result.ok) {
      expect(result.botText).toContain('🎙️ Entendi: "gastei 30 reais no mercado"');
      expect(result.botText).toContain("R$ 30,00");
    }
  });

  it("os comandos também funcionam por voz: 'apaga o último' apaga a última transação", async () => {
    const { service, fake, store } = withRealCore();
    await service.sendVoice("user-1", audio());
    expect(store.transactions).toHaveLength(1);

    fake.control.transcript = "apaga o último";
    const result = await service.sendVoice("user-1", audio());

    expect(result.ok).toBe(true);
    expect(store.transactions).toHaveLength(0);
  });

  it("uma fala sem valor não grava nada e a resposta pede pra reformular", async () => {
    const { service, fake, store, sources } = withRealCore();
    fake.control.transcript = "oi tudo bem";

    const result = await service.sendVoice("user-1", audio());

    expect(result.ok).toBe(true);
    expect(store.transactions).toHaveLength(0);
    expect(sources).toHaveLength(0);
    if (result.ok) expect(result.botText).toContain('🎙️ Entendi: "oi tudo bem"');
  });
});
