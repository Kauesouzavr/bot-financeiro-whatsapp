import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O pacote "server-only" quebra de propósito fora do servidor Next; nos testes ele não faz nada.
vi.mock("server-only", () => ({}));

import { extractTransactionsWithGroq } from "@/services/groq/extract-transactions";

const VALID_CONTENT = JSON.stringify({
  transactions: [
    {
      type: "expense",
      amount: "89,90",
      description: "ração do cachorro",
      date: "today",
      day_of_month: null,
      category: "Compras",
    },
  ],
});

function groqResponse(content: unknown, init: ResponseInit = { status: 200 }) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), init);
}

describe("extractTransactionsWithGroq", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("GROQ_API_KEY", "chave-de-teste");
    vi.stubEnv("GROQ_LLM_MODEL", "openai/gpt-oss-20b");
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("devolve a extração quando o Groq responde um JSON válido", async () => {
    fetchMock.mockResolvedValue(groqResponse(VALID_CONTENT));

    const result = await extractTransactionsWithGroq("comprei ração pro cachorro por 89,90");

    expect(result?.transactions).toHaveLength(1);
    expect(result?.transactions[0].amount).toBe("89,90");
  });

  it("manda só o texto da mensagem, com a chave, o modelo e saída JSON estrita", async () => {
    fetchMock.mockResolvedValue(groqResponse(VALID_CONTENT));

    await extractTransactionsWithGroq("comprei ração pro cachorro por 89,90");

    const [url, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(options.headers.Authorization).toBe("Bearer chave-de-teste");
    expect(body.model).toBe("openai/gpt-oss-20b");
    expect(body.temperature).toBe(0);
    expect(body.reasoning_effort).toBe("low");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.messages.at(-1)).toEqual({
      role: "user",
      content: "comprei ração pro cachorro por 89,90",
    });
  });

  it("não manda reasoning_effort pra modelos que não são gpt-oss", async () => {
    vi.stubEnv("GROQ_LLM_MODEL", "outro-modelo");
    fetchMock.mockResolvedValue(groqResponse(VALID_CONTENT));

    await extractTransactionsWithGroq("x 10");

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("reasoning_effort");
  });

  it("corta mensagens muito longas antes de enviar", async () => {
    fetchMock.mockResolvedValue(groqResponse(VALID_CONTENT));

    await extractTransactionsWithGroq("a".repeat(2000));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages.at(-1).content).toHaveLength(500);
  });

  it("devolve null sem chamar a rede quando falta a chave ou o modelo", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    expect(await extractTransactionsWithGroq("x 10")).toBeNull();

    vi.stubEnv("GROQ_API_KEY", "chave-de-teste");
    vi.stubEnv("GROQ_LLM_MODEL", "");
    expect(await extractTransactionsWithGroq("x 10")).toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("devolve null quando o plano grátis estoura o limite (429)", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 429 }));
    expect(await extractTransactionsWithGroq("x 10")).toBeNull();
  });

  it("devolve null quando a rede falha ou estoura o tempo", async () => {
    fetchMock.mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    expect(await extractTransactionsWithGroq("x 10")).toBeNull();
  });

  it("devolve null quando o conteúdo não é JSON", async () => {
    fetchMock.mockResolvedValue(groqResponse("desculpa, não consegui"));
    expect(await extractTransactionsWithGroq("x 10")).toBeNull();
  });

  it("devolve null quando o JSON não bate com o schema", async () => {
    fetchMock.mockResolvedValue(
      groqResponse(JSON.stringify({ transactions: [{ type: "expense", amount: "R$ 10" }] })),
    );
    expect(await extractTransactionsWithGroq("x 10")).toBeNull();
  });

  it("devolve null quando a resposta vem sem choices", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await extractTransactionsWithGroq("x 10")).toBeNull();
  });

  it("nunca coloca o texto da mensagem nos logs de erro", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));

    await extractTransactionsWithGroq("gastei 999 no segredo");

    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("segredo");
  });
});
