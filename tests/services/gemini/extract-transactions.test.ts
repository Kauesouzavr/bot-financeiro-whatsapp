import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O pacote "server-only" quebra de propósito fora do servidor Next; nos testes ele não faz nada.
vi.mock("server-only", () => ({}));

import { extractTransactionsWithGemini } from "@/services/gemini/extract-transactions";

const VALID_CONTENT = JSON.stringify({
  transactions: [
    {
      type: "expense",
      amount: "30",
      description: "passagem de ônibus",
      date: "today",
      day_of_month: null,
      category: "Transporte",
    },
  ],
});

function geminiResponse(parts: unknown[], init: ResponseInit = { status: 200 }) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts } }] }), init);
}

describe("extractTransactionsWithGemini", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "chave-de-teste");
    vi.stubEnv("GEMINI_MODEL", "gemini-3.5-flash-lite");
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("devolve a extração quando o Gemini responde um JSON válido", async () => {
    fetchMock.mockResolvedValue(geminiResponse([{ text: VALID_CONTENT }]));

    const result = await extractTransactionsWithGemini("paguei trinta reais de passagem de ônibus");

    expect(result?.transactions).toHaveLength(1);
    expect(result?.transactions[0].amount).toBe("30");
  });

  it("manda só o texto da mensagem, com a chave no cabeçalho e saída JSON", async () => {
    fetchMock.mockResolvedValue(geminiResponse([{ text: VALID_CONTENT }]));

    await extractTransactionsWithGemini("paguei trinta reais de passagem de ônibus");

    const [url, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
    );
    // A chave nunca aparece na URL.
    expect(url).not.toContain("chave-de-teste");
    expect(options.headers["x-goog-api-key"]).toBe("chave-de-teste");
    expect(body.generationConfig.temperature).toBe(0);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema.required).toEqual(["transactions"]);
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "paguei trinta reais de passagem de ônibus" }] },
    ]);
  });

  it("não manda `pattern` no schema do Gemini (o zod confere o valor depois)", async () => {
    fetchMock.mockResolvedValue(geminiResponse([{ text: VALID_CONTENT }]));

    await extractTransactionsWithGemini("x 10");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const amount =
      body.generationConfig.responseJsonSchema.properties.transactions.items.properties.amount;
    expect(amount).toEqual({ type: "string" });
  });

  it("ignora as partes de raciocínio e usa só o texto da resposta", async () => {
    fetchMock.mockResolvedValue(
      geminiResponse([{ text: "pensando...", thought: true }, { text: VALID_CONTENT }]),
    );

    const result = await extractTransactionsWithGemini("x 10");

    expect(result?.transactions).toHaveLength(1);
  });

  it("corta mensagens muito longas antes de enviar", async () => {
    fetchMock.mockResolvedValue(geminiResponse([{ text: VALID_CONTENT }]));

    await extractTransactionsWithGemini("a".repeat(2000));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].text).toHaveLength(500);
  });

  it("devolve null sem chamar a rede quando falta a chave ou o modelo", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(await extractTransactionsWithGemini("x 10")).toBeNull();

    vi.stubEnv("GEMINI_API_KEY", "chave-de-teste");
    vi.stubEnv("GEMINI_MODEL", "");
    expect(await extractTransactionsWithGemini("x 10")).toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("devolve null quando o limite do plano grátis estoura (429)", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 429 }));
    expect(await extractTransactionsWithGemini("x 10")).toBeNull();
  });

  it("devolve null quando a rede falha ou estoura o tempo", async () => {
    fetchMock.mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    expect(await extractTransactionsWithGemini("x 10")).toBeNull();
  });

  it("devolve null quando o conteúdo não é JSON ou não bate com o schema", async () => {
    fetchMock.mockResolvedValueOnce(geminiResponse([{ text: "desculpa, não consegui" }]));
    expect(await extractTransactionsWithGemini("x 10")).toBeNull();

    fetchMock.mockResolvedValueOnce(
      geminiResponse([
        { text: JSON.stringify({ transactions: [{ type: "expense", amount: "R$ 10" }] }) },
      ]),
    );
    expect(await extractTransactionsWithGemini("x 10")).toBeNull();
  });

  it("devolve null quando a resposta vem sem candidatos ou sem texto", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    expect(await extractTransactionsWithGemini("x 10")).toBeNull();

    fetchMock.mockResolvedValueOnce(geminiResponse([]));
    expect(await extractTransactionsWithGemini("x 10")).toBeNull();
  });

  it("nunca coloca o texto da mensagem nos logs de erro", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));

    await extractTransactionsWithGemini("gastei 999 no segredo");

    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("segredo");
  });
});
