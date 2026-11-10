import { z } from "zod";

// Tipos de áudio aceitos: os formatos que o próprio celular grava. O iPhone (Safari) grava MP4 com AAC;
// Android e computador gravam WebM ou OGG com Opus. WAV fica como saída de emergência.
export const VOICE_ALLOWED_MIME_TYPES = [
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
  "audio/wav",
] as const;

export type VoiceMimeType = (typeof VOICE_ALLOWED_MIME_TYPES)[number];

// Um minuto de áudio comprimido tem poucas centenas de KB: 1,5 MB sobra e fica bem abaixo do limite
// de corpo da Vercel (cerca de 4,5 MB).
export const VOICE_MAX_BYTES = 1.5 * 1024 * 1024;
export const VOICE_MAX_SECONDS = 60;
// Gravação mais curta que isso é quase sempre um toque sem querer.
export const VOICE_MIN_SECONDS = 1;

// O que o modelo devolve ao ouvir uma gravação: só o texto. Quem entende o texto é o mesmo núcleo
// do chat digitado. O limite aqui só segura uma resposta absurda; o limite de verdade é conferido
// no chat (MAX_CHAT_MESSAGE_LENGTH).
export const voiceTranscriptionSchema = z.object({
  transcript: z.string().max(2000),
});

export const VOICE_USER_TEXT = "🎙️ Mensagem de voz";

// A resposta sempre mostra o que foi entendido, pra pessoa perceber na hora se o áudio foi mal ouvido.
export function formatVoiceReply(transcript: string, replyText: string): string {
  return [`🎙️ Entendi: "${transcript}"`, replyText].join("\n");
}

export const VOICE_MESSAGES = {
  invalidFile: "Não consegui usar essa gravação. Grave de novo, com até 1 minuto.",
  failed: "Não consegui entender o áudio agora. Tente de novo em instantes.",
  noSpeech: "Não ouvi nada nessa gravação. Tente de novo, falando mais perto do microfone.",
  tooLong:
    'Essa gravação ficou longa demais para um registro. Fale só o gasto, tipo "gastei 45 no mercado".',
  tooShort: "A gravação ficou curta demais. Toque no 🎤, fale e toque de novo para enviar.",
  micDenied:
    "Não consegui usar o microfone. Libere o microfone para este app nas configurações do celular e tente de novo.",
} as const;
