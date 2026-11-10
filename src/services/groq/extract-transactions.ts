import "server-only";
import type { AiExtraction } from "@/core/ai/extraction";
import {
  AI_REQUEST_TIMEOUT_MS,
  buildResponseSchema,
  MAX_MESSAGE_LENGTH,
  parseExtractionContent,
  SYSTEM_PROMPT,
} from "../ai/extraction-request";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

const RESPONSE_JSON_SCHEMA = {
  name: "finance_records",
  strict: true,
  schema: buildResponseSchema({ amountPattern: true }),
};

// IA de reserva: só roda quando o parser por regras não entendeu a mensagem.
// Devolve null em qualquer falha (sem chave, limite do plano, timeout, JSON fora do schema):
// quem chama tenta o próximo provedor ou responde "não entendi". Nunca loga o conteúdo da mensagem.
export async function extractTransactionsWithGroq(message: string): Promise<AiExtraction | null> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_LLM_MODEL;
  if (!apiKey || !model) return null;

  try {
    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_completion_tokens: 1000,
        // Os modelos gpt-oss "raciocinam" antes de responder; pra extrair dados, o esforço baixo basta.
        ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message.slice(0, MAX_MESSAGE_LENGTH) },
        ],
        response_format: { type: "json_schema", json_schema: RESPONSE_JSON_SCHEMA },
      }),
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`Groq respondeu com status ${response.status}`);
      return null;
    }

    const data: unknown = await response.json();
    const content = (data as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]
      ?.message?.content;
    if (typeof content !== "string") return null;

    return parseExtractionContent(content, "Groq");
  } catch (error) {
    console.error("Erro ao chamar o Groq:", error instanceof Error ? error.name : "desconhecido");
    return null;
  }
}
