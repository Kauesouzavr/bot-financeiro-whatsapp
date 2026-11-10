import { describe, expect, it, vi } from "vitest";
import type { AiExtraction } from "@/core/ai/extraction";
import { chainExtractors, type AiExtractor } from "@/core/ai/fallback-chain";

const COMPRA: AiExtraction = {
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
};

const NAO_E_REGISTRO: AiExtraction = { transactions: [] };

function extractor(result: AiExtraction | null) {
  return vi.fn<AiExtractor>(async () => result);
}

describe("chainExtractors", () => {
  it("devolve a resposta do primeiro provedor e não chama o segundo", async () => {
    const first = extractor(COMPRA);
    const second = extractor(NAO_E_REGISTRO);

    const result = await chainExtractors([first, second])("paguei trinta reais de ônibus");

    expect(result).toBe(COMPRA);
    expect(second).not.toHaveBeenCalled();
  });

  it("passa pro segundo provedor quando o primeiro falha (null)", async () => {
    const first = extractor(null);
    const second = extractor(COMPRA);

    const result = await chainExtractors([first, second])("paguei trinta reais de ônibus");

    expect(result).toBe(COMPRA);
    expect(first).toHaveBeenCalledWith("paguei trinta reais de ônibus");
    expect(second).toHaveBeenCalledWith("paguei trinta reais de ônibus");
  });

  it("lista vazia é resposta válida: para ali e não manda a mensagem pro segundo provedor", async () => {
    const first = extractor(NAO_E_REGISTRO);
    const second = extractor(COMPRA);

    const result = await chainExtractors([first, second])("bom dia");

    expect(result).toBe(NAO_E_REGISTRO);
    expect(second).not.toHaveBeenCalled();
  });

  it("devolve null quando todos os provedores falham", async () => {
    const result = await chainExtractors([extractor(null), extractor(null)])("x");
    expect(result).toBeNull();
  });

  it("devolve null sem provedores", async () => {
    expect(await chainExtractors([])("x")).toBeNull();
  });
});
