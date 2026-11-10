import "server-only";
import type { AiExtraction } from "@/core/ai/extraction";
import {
  AI_REQUEST_TIMEOUT_MS,
  buildResponseSchema,
  MAX_MESSAGE_LENGTH,
  parseExtractionContent,
  SYSTEM_PROMPT,
} from "../ai/extraction-request";

const GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiPart = { text?: unknown; thought?: unknown };

// IA de reserva do reserva: só roda se o Groq falhar. Atenção: no plano grátis o Google pode usar
// o que for enviado pra treinar modelos, então só o texto da mensagem vai, sem id, nome nem telefone.
// Devolve null em qualquer falha. Nunca loga o conteúdo da mensagem.
export async function extractTransactionsWithGemini(message: string): Promise<AiExtraction | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey || !model) return null;

  try {
    const response = await fetch(
      `${GEMINI_MODELS_URL}/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        // A chave vai no cabeçalho, nunca na URL (URLs aparecem em logs).
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: message.slice(0, MAX_MESSAGE_LENGTH) }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 2000,
            responseMimeType: "application/json",
            responseJsonSchema: buildResponseSchema({ amountPattern: false }),
          },
        }),
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      console.error(`Gemini respondeu com status ${response.status}`);
      return null;
    }

    const data: unknown = await response.json();
    const parts = (data as { candidates?: { content?: { parts?: GeminiPart[] } }[] })
      .candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return null;

    // Modelos que "pensam" podem devolver partes de raciocínio junto: só o texto da resposta interessa.
    const text = parts
      .filter((part) => typeof part.text === "string" && part.thought !== true)
      .map((part) => part.text as string)
      .join("");
    if (!text) return null;

    return parseExtractionContent(text, "Gemini");
  } catch (error) {
    console.error("Erro ao chamar o Gemini:", error instanceof Error ? error.name : "desconhecido");
    return null;
  }
}
