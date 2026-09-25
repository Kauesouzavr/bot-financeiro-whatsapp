import { z } from "zod";
import type { CoreInput } from "@/core/types";

const webhookMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
});

const webhookPayloadSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z.array(
          z.object({
            field: z.string(),
            value: z.object({
              messages: z.array(webhookMessageSchema).optional(),
            }),
          }),
        ),
      }),
    )
    .optional(),
});

export interface IncomingWhatsAppMessage {
  waMessageId: string;
  from: string;
  type: string;
  text: string | null;
}

// Só lê `value.messages` — eventos de status (enviado/entregue/lido) ficam
// em `value.statuses` e nunca são olhados aqui, então são ignorados por construção.
export function parseWebhookPayload(rawPayload: unknown): IncomingWhatsAppMessage[] {
  const result = webhookPayloadSchema.safeParse(rawPayload);
  if (!result.success) return [];

  const messages: IncomingWhatsAppMessage[] = [];

  for (const entry of result.data.entry ?? []) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      for (const message of change.value.messages ?? []) {
        messages.push({
          waMessageId: message.id,
          from: message.from,
          type: message.type,
          text: message.text?.body ?? null,
        });
      }
    }
  }

  return messages;
}

// Traduz o formato da Meta pro formato normalizado do núcleo. Só "text" é
// processado de verdade por enquanto (áudio/foto chegam nas Fases 5 e 6);
// qualquer outro tipo cai no "por enquanto só entendo texto" que o
// handle-message já responde sozinho.
export function toCoreInput(message: IncomingWhatsAppMessage, userId: string): CoreInput {
  if (message.type === "text") {
    return { userId, kind: "text", content: message.text ?? "", source: "text" };
  }
  if (message.type === "audio") {
    return { userId, kind: "audio", content: "", source: "audio" };
  }
  if (message.type === "image") {
    return { userId, kind: "image", content: "", source: "image" };
  }
  return { userId, kind: "button", content: "", source: "text" };
}
