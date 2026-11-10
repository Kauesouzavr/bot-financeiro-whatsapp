import { describe, expect, it } from "vitest";
import {
  VOICE_ALLOWED_MIME_TYPES,
  VOICE_MAX_BYTES,
  VOICE_MAX_SECONDS,
  VOICE_MIN_SECONDS,
  VOICE_USER_TEXT,
  formatVoiceReply,
  voiceTranscriptionSchema,
} from "@/core/ai/voice";

describe("limites da gravação de voz", () => {
  it("o arquivo cabe com folga no limite de corpo do servidor (4 MB)", () => {
    expect(VOICE_MAX_BYTES).toBeLessThan(4 * 1024 * 1024);
    expect(Number.isInteger(VOICE_MAX_BYTES)).toBe(true);
  });

  it("a gravação vai de 1 a 60 segundos", () => {
    expect(VOICE_MIN_SECONDS).toBe(1);
    expect(VOICE_MAX_SECONDS).toBe(60);
  });

  it("aceita os formatos que o iPhone, o Android e o computador gravam", () => {
    expect(VOICE_ALLOWED_MIME_TYPES).toEqual(
      expect.arrayContaining(["audio/mp4", "audio/webm", "audio/ogg"]),
    );
  });
});

describe("formatVoiceReply", () => {
  it("mostra o que foi entendido antes da resposta de sempre", () => {
    const reply = formatVoiceReply(
      "gastei 30 reais no mercado",
      "✅ R$ 30,00 em Mercado\nNovembro: saldo R$ 70,00",
    );

    expect(reply).toBe(
      '🎙️ Entendi: "gastei 30 reais no mercado"\n✅ R$ 30,00 em Mercado\nNovembro: saldo R$ 70,00',
    );
  });

  it("o balão da pessoa não repete o texto: ele só diz que foi uma mensagem de voz", () => {
    expect(VOICE_USER_TEXT).toBe("🎙️ Mensagem de voz");
  });
});

describe("voiceTranscriptionSchema", () => {
  it("aceita um texto e também o texto vazio (gravação sem fala)", () => {
    expect(voiceTranscriptionSchema.safeParse({ transcript: "gastei 30 no mercado" }).success).toBe(
      true,
    );
    expect(voiceTranscriptionSchema.safeParse({ transcript: "" }).success).toBe(true);
  });

  it("recusa o que não é o formato esperado", () => {
    expect(voiceTranscriptionSchema.safeParse({}).success).toBe(false);
    expect(voiceTranscriptionSchema.safeParse({ transcript: 30 }).success).toBe(false);
    expect(voiceTranscriptionSchema.safeParse({ transcript: "a".repeat(2001) }).success).toBe(
      false,
    );
  });
});
