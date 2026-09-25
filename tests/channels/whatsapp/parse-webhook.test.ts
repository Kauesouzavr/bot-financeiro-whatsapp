import { describe, expect, it } from "vitest";
import { parseWebhookPayload, toCoreInput } from "@/channels/whatsapp/parse-webhook";

function buildPayload(changes: unknown[]) {
  return { entry: [{ changes }] };
}

describe("parseWebhookPayload", () => {
  it("extrai uma mensagem de texto", () => {
    const payload = buildPayload([
      {
        field: "messages",
        value: {
          messages: [
            {
              from: "5511987654321",
              id: "wamid.1",
              type: "text",
              text: { body: "gastei 45 no ifood" },
            },
          ],
        },
      },
    ]);

    expect(parseWebhookPayload(payload)).toEqual([
      { waMessageId: "wamid.1", from: "5511987654321", type: "text", text: "gastei 45 no ifood" },
    ]);
  });

  it("ignora eventos de status (enviado/entregue/lido)", () => {
    const payload = buildPayload([
      { field: "messages", value: { statuses: [{ id: "wamid.1", status: "delivered" }] } },
    ]);

    expect(parseWebhookPayload(payload)).toEqual([]);
  });

  it("ignora changes que não são do campo messages", () => {
    const payload = buildPayload([
      { field: "outro-campo", value: { messages: [{ from: "1", id: "x", type: "text" }] } },
    ]);

    expect(parseWebhookPayload(payload)).toEqual([]);
  });

  it("devolve lista vazia para payload em formato inesperado", () => {
    expect(parseWebhookPayload({ algumaCoisa: true })).toEqual([]);
    expect(parseWebhookPayload(null)).toEqual([]);
  });
});

describe("toCoreInput", () => {
  it("mensagem de texto vira kind text com o conteúdo", () => {
    const input = toCoreInput(
      { waMessageId: "1", from: "5511987654321", type: "text", text: "gastei 45 no ifood" },
      "user-1",
    );
    expect(input).toEqual({
      userId: "user-1",
      kind: "text",
      content: "gastei 45 no ifood",
      source: "text",
    });
  });

  it("mensagem de áudio vira kind audio, ainda sem conteúdo (Fase 5)", () => {
    const input = toCoreInput(
      { waMessageId: "1", from: "551199999999", type: "audio", text: null },
      "user-1",
    );
    expect(input.kind).toBe("audio");
    expect(input.source).toBe("audio");
  });

  it("tipo desconhecido cai no fallback (button)", () => {
    const input = toCoreInput(
      { waMessageId: "1", from: "551199999999", type: "sticker", text: null },
      "user-1",
    );
    expect(input.kind).toBe("button");
  });
});
