import { after, type NextRequest } from "next/server";
import { getSaoPauloParts } from "@/core/date/sao-paulo";
import { handleMessage } from "@/core/handle-message";
import { checkQuota } from "@/core/quota/check-quota";
import { formatQuotaWarning } from "@/core/replies/format-reply";
import {
  parseWebhookPayload,
  toCoreInput,
  type IncomingWhatsAppMessage,
} from "@/channels/whatsapp/parse-webhook";
import { maskPhone, phoneVariants } from "@/channels/whatsapp/phone";
import { sendWhatsAppText } from "@/channels/whatsapp/send-message";
import { isValidSignature } from "@/channels/whatsapp/verify-signature";
import { getMonthlyReplies, incrementMonthlyReplies } from "@/services/supabase/monthly-usage";
import { markMessageProcessed } from "@/services/supabase/processed-messages";
import { findActiveUserByPhone } from "@/services/supabase/users";

const MONTHLY_REPLY_LIMIT = Number(process.env.MONTHLY_REPLY_LIMIT ?? "950");

export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";

  if (!isValidSignature(rawBody, signature, appSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // Responde 200 na hora; o processamento de verdade roda depois, sem
  // segurar a resposta pra Meta (ela reenvia se demorar demais).
  after(() => processWebhook(payload));

  return new Response("OK", { status: 200 });
}

async function processWebhook(payload: unknown): Promise<void> {
  const messages = parseWebhookPayload(payload);

  for (const message of messages) {
    try {
      await processMessage(message);
    } catch (error) {
      console.error(
        `Erro processando mensagem do WhatsApp (${maskPhone(message.from)}):`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

async function processMessage(message: IncomingWhatsAppMessage): Promise<void> {
  const isNewMessage = await markMessageProcessed(message.waMessageId);
  if (!isNewMessage) return;

  const user = await findActiveUserByPhone(phoneVariants(message.from));
  if (!user) return;

  const replies = await handleMessage(toCoreInput(message, user.id));

  const today = getSaoPauloParts();
  const month = `${today.year}-${String(today.month).padStart(2, "0")}`;
  const repliesSentSoFar = await getMonthlyReplies(month);
  const quota = checkQuota(repliesSentSoFar, MONTHLY_REPLY_LIMIT);

  if (!quota.shouldSend) return;

  const replyText = replies.map((reply) => reply.text).join("\n\n");
  const finalText = quota.warn ? `${replyText}\n\n${formatQuotaWarning()}` : replyText;

  await sendWhatsAppText(message.from, finalText);
  await incrementMonthlyReplies(month, repliesSentSoFar);
}
