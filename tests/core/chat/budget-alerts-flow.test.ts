import { describe, expect, it, vi } from "vitest";
import type { ReceiptExtraction } from "@/core/ai/receipt";
import type { ReceiptFile } from "@/core/chat/chat-service";
import { createFakeChat } from "../../helpers/fake-chat";

const EXTRACTION: ReceiptExtraction = {
  is_receipt: true,
  kind: "expense",
  amount: "45,90",
  counterparty: "Mercado Exemplo Ltda",
  date: "2026-09-14",
  category: "Mercado",
};

const FILE: ReceiptFile = { mimeType: "image/jpeg", bytes: new Uint8Array([1, 2, 3]) };

// Envia o comprovante e toca em "Salvar": é aqui que o gasto entra de fato.
async function save(options: Parameters<typeof createFakeChat>[0]) {
  const fake = createFakeChat({ extraction: EXTRACTION, ...options });
  await fake.service.sendReceipt("user-1", FILE);
  return fake.service.confirmPending("user-1", fake.pendings[0].id);
}

function lines(result: Awaited<ReturnType<typeof save>>): string[] {
  if (!result.ok) throw new Error("o teste esperava que o comprovante fosse salvo");
  return result.botText.split("\n");
}

describe("Salvar comprovante: aviso de orçamento", () => {
  it("junta o aviso à resposta quando o comprovante deixa a categoria perto do limite", async () => {
    const result = await save({ budgets: [{ category: "Mercado", limitCents: 5000 }] });

    expect(lines(result)).toEqual([
      "✅ R$ 45,90 em Mercado (mercado exemplo ltda)",
      "⚠️ Mercado: R$ 45,90 de R$ 50,00 (91%)",
      "Setembro: entrou R$ 1.500,00 · saiu R$ 90,90 · saldo R$ 1.409,10",
    ]);
  });

  it("não acrescenta nada quando a categoria tem folga ou não tem orçamento", async () => {
    const roomy = await save({ budgets: [{ category: "Mercado", limitCents: 100000 }] });
    const none = await save({});

    expect(lines(roomy)).toHaveLength(2);
    expect(lines(none)).toHaveLength(2);
  });

  it("se os orçamentos não puderem ser lidos, o comprovante é salvo do mesmo jeito", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await save({ budgetsError: new Error("tabela inexistente") });

    expect(lines(result)).toHaveLength(2);
    errorSpy.mockRestore();
  });
});
