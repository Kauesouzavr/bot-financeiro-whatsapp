import { describe, expect, it } from "vitest";
import {
  formatReceiptPrompt,
  formatReceiptSummary,
  pendingTransactionSchema,
  receiptExtractionSchema,
  receiptToPendingTransaction,
  type ReceiptExtraction,
} from "@/core/ai/receipt";
import { NOW } from "../../helpers/fake-deps";

// NOW = terça, 2026-09-15 (meio-dia em São Paulo).

function extraction(overrides: Partial<ReceiptExtraction> = {}): ReceiptExtraction {
  return {
    is_receipt: true,
    kind: "expense",
    amount: "45,90",
    counterparty: "Mercado Exemplo Ltda",
    date: "2026-09-14",
    category: "Mercado",
    ...overrides,
  };
}

describe("receiptExtractionSchema", () => {
  it("aceita uma leitura válida", () => {
    expect(receiptExtractionSchema.safeParse(extraction()).success).toBe(true);
  });

  it("aceita comprovante sem nome e sem data (null)", () => {
    expect(
      receiptExtractionSchema.safeParse(extraction({ counterparty: null, date: null })).success,
    ).toBe(true);
  });

  it.each([
    ["tipo desconhecido", { ...extraction(), kind: "transfer" }],
    ["is_receipt faltando", { ...extraction(), is_receipt: undefined }],
    ["nome enorme", extraction({ counterparty: "x".repeat(81) })],
    ["valor enorme", extraction({ amount: "9".repeat(31) })],
  ])("rejeita %s", (_label, bad) => {
    expect(receiptExtractionSchema.safeParse(bad).success).toBe(false);
  });
});

describe("receiptToPendingTransaction", () => {
  it("monta a transação: centavos inteiros, descrição em minúsculas e a data do comprovante", () => {
    expect(receiptToPendingTransaction(extraction(), {}, NOW)).toEqual({
      ok: true,
      transaction: {
        type: "expense",
        amountCents: 4590,
        description: "mercado exemplo ltda",
        category: "Mercado",
        occurredOn: "2026-09-14",
      },
    });
  });

  it("entende Pix recebido como entrada", () => {
    const result = receiptToPendingTransaction(
      extraction({ kind: "income", counterparty: "Maria", category: "Pix recebido" }),
      {},
      NOW,
    );
    expect(result).toMatchObject({
      ok: true,
      transaction: { type: "income", category: "Pix recebido" },
    });
  });

  it("usa a data de hoje (em São Paulo) quando o comprovante não mostra data", () => {
    const result = receiptToPendingTransaction(extraction({ date: null }), {}, NOW);
    expect(result).toMatchObject({ ok: true, transaction: { occurredOn: "2026-09-15" } });
  });

  it("recusa o que não é comprovante", () => {
    expect(receiptToPendingTransaction(extraction({ is_receipt: false }), {}, NOW)).toEqual({
      ok: false,
      reason: "not_receipt",
    });
  });

  it.each(["", "0", "0,00", "R$ 45,90", "45.90", "1.234,56", "abc", "-5", "1234567,00"])(
    "recusa valor ilegível ou fora do formato: %j",
    (amount) => {
      expect(receiptToPendingTransaction(extraction({ amount }), {}, NOW)).toEqual({
        ok: false,
        reason: "unreadable",
      });
    },
  );

  it.each([
    ["data impossível", "2026-02-31"],
    ["mês 13", "2026-13-01"],
    ["formato errado", "14/09/2026"],
    ["muito no futuro", "2026-12-25"],
    ["muito antiga", "2024-01-10"],
  ])("recusa %s", (_label, date) => {
    expect(receiptToPendingTransaction(extraction({ date }), {}, NOW)).toEqual({
      ok: false,
      reason: "bad_date",
    });
  });

  it("aceita hoje, ontem e o dia seguinte (tolerância de fuso)", () => {
    for (const date of ["2026-09-15", "2026-09-14", "2026-09-16"]) {
      expect(receiptToPendingTransaction(extraction({ date }), {}, NOW).ok).toBe(true);
    }
  });

  it("categoria: o que a pessoa ensinou vence o dicionário, que vence a sugestão da IA", () => {
    const learned = { "mercado exemplo": "Lazer" };
    expect(receiptToPendingTransaction(extraction(), learned, NOW)).toMatchObject({
      transaction: { category: "Lazer" },
    });
    // Sem aprendizado, "mercado" cai no dicionário (Mercado), mesmo que a IA sugira outra.
    expect(receiptToPendingTransaction(extraction({ category: "Compras" }), {}, NOW)).toMatchObject(
      {
        transaction: { category: "Mercado" },
      },
    );
    // Nome que ninguém conhece: vale a sugestão válida da IA.
    expect(
      receiptToPendingTransaction(
        extraction({ counterparty: "Fulano de Tal", category: "Saúde" }),
        {},
        NOW,
      ),
    ).toMatchObject({ transaction: { category: "Saúde" } });
  });

  it("ignora sugestão de categoria inválida ou do tipo errado", () => {
    expect(
      receiptToPendingTransaction(
        extraction({ counterparty: "Fulano", category: "Inventada" }),
        {},
        NOW,
      ),
    ).toMatchObject({ transaction: { category: "Outros" } });
    expect(
      receiptToPendingTransaction(
        extraction({ kind: "income", counterparty: "Fulano", category: "Lazer" }),
        {},
        NOW,
      ),
    ).toMatchObject({ transaction: { category: "Outras entradas" } });
  });

  it("nome vazio vira descrição null", () => {
    expect(receiptToPendingTransaction(extraction({ counterparty: "   " }), {}, NOW)).toMatchObject(
      {
        transaction: { description: null },
      },
    );
  });
});

describe("pendingTransactionSchema", () => {
  it("aceita o que o próprio sistema guarda", () => {
    const stored = {
      type: "expense",
      amountCents: 4590,
      description: null,
      category: "Outros",
      occurredOn: "2026-09-14",
    };
    expect(pendingTransactionSchema.safeParse(stored).success).toBe(true);
  });

  it.each([
    ["valor zero", { amountCents: 0 }],
    ["valor negativo", { amountCents: -1 }],
    ["valor decimal", { amountCents: 45.9 }],
    ["data fora do formato", { occurredOn: "14/09/2026" }],
    ["tipo inválido", { type: "transfer" }],
  ])("rejeita payload adulterado: %s", (_label, change) => {
    const base = {
      type: "expense",
      amountCents: 4590,
      description: null,
      category: "Outros",
      occurredOn: "2026-09-14",
    };
    expect(pendingTransactionSchema.safeParse({ ...base, ...change }).success).toBe(false);
  });
});

describe("textos do comprovante", () => {
  const transaction = {
    type: "expense" as const,
    amountCents: 4590,
    description: "mercado exemplo ltda",
    category: "Mercado",
    occurredOn: "2026-09-14",
  };

  it("a mensagem do bot mostra valor, categoria, descrição e data em formato brasileiro", () => {
    expect(formatReceiptPrompt(transaction)).toBe(
      [
        "Li o comprovante:",
        "💸 Saída de R$ 45,90 em Mercado (mercado exemplo ltda)",
        "📅 14/09/2026",
        "Confere? Toque em Salvar ou Cancelar. Esta confirmação vale por 24 horas.",
      ].join("\n"),
    );
  });

  it("entrada aparece como entrada", () => {
    expect(formatReceiptPrompt({ ...transaction, type: "income", description: null })).toContain(
      "💰 Entrada de R$ 45,90 em Mercado",
    );
  });

  it("o resumo de uma linha do cartão", () => {
    expect(formatReceiptSummary(transaction)).toBe(
      "Saída de R$ 45,90 · mercado exemplo ltda · 14/09/2026",
    );
  });
});
