import { describe, expect, it, vi } from "vitest";
import { RECEIPT_MAX_BYTES, RECEIPT_MESSAGES, type ReceiptExtraction } from "@/core/ai/receipt";
import { createChatService, type ReceiptFile } from "@/core/chat/chat-service";
import { createFakeChat } from "../../helpers/fake-chat";

const EXTRACTION: ReceiptExtraction = {
  is_receipt: true,
  kind: "expense",
  amount: "45,90",
  counterparty: "Mercado Exemplo Ltda",
  date: "2026-09-14",
  category: "Mercado",
};

function file(overrides: Partial<ReceiptFile> = {}): ReceiptFile {
  return { mimeType: "image/jpeg", bytes: new Uint8Array([1, 2, 3]), ...overrides };
}

function setup(extraction: ReceiptExtraction | null = EXTRACTION) {
  return createFakeChat({ extraction });
}

describe("sendReceipt", () => {
  it("lê o comprovante e guarda como PENDÊNCIA, sem gravar nenhuma transação", async () => {
    const { service, inserted, pendings } = setup();

    const result = await service.sendReceipt("user-1", file());

    expect(result.ok).toBe(true);
    expect(inserted).toHaveLength(0);
    expect(pendings).toHaveLength(1);
    expect(pendings[0].transaction).toEqual({
      type: "expense",
      amountCents: 4590,
      description: "mercado exemplo ltda",
      category: "Mercado",
      occurredOn: "2026-09-14",
    });
  });

  it("a pendência vale 24 horas a partir de agora", async () => {
    const { service, pendings, clock } = setup();

    await service.sendReceipt("user-1", file());

    expect(pendings[0].expiresAt.getTime()).toBe(clock.now.getTime() + 24 * 60 * 60 * 1000);
  });

  it("responde com o resumo pra confirmar e guarda os dois balões no histórico", async () => {
    const { service, stored } = setup();

    const result = await service.sendReceipt("user-1", file());

    expect(result).toMatchObject({
      ok: true,
      userText: "📎 Comprovante enviado",
      pending: { summary: "Saída de R$ 45,90 · mercado exemplo ltda · 14/09/2026" },
    });
    expect(stored.map((message) => message.role)).toEqual(["user", "bot"]);
    expect(stored[1].text).toContain("Li o comprovante");
    expect(stored[1].text).toContain("Salvar ou Cancelar");
  });

  it("manda o arquivo pra IA exatamente como veio", async () => {
    const { service, extracted } = setup();
    const pdf = file({
      mimeType: "application/pdf",
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    });

    await service.sendReceipt("user-1", pdf);

    expect(extracted).toEqual([pdf]);
  });

  it.each([
    ["tipo não aceito", file({ mimeType: "text/html" })],
    ["arquivo vazio", file({ bytes: new Uint8Array() })],
    ["arquivo grande demais", file({ bytes: new Uint8Array(RECEIPT_MAX_BYTES + 1) })],
  ])("recusa %s sem chamar a IA", async (_label, bad) => {
    const { service, extracted, pendings } = setup();

    const result = await service.sendReceipt("user-1", bad);

    expect(result).toEqual({ ok: false, error: RECEIPT_MESSAGES.invalidFile });
    expect(extracted).toHaveLength(0);
    expect(pendings).toHaveLength(0);
  });

  it("aceita arquivo exatamente no limite de tamanho", async () => {
    const { service } = setup();
    const result = await service.sendReceipt(
      "user-1",
      file({ bytes: new Uint8Array(RECEIPT_MAX_BYTES) }),
    );
    expect(result.ok).toBe(true);
  });

  it("se a IA falhar, avisa e não guarda nada", async () => {
    const { service, pendings, stored } = setup(null);

    expect(await service.sendReceipt("user-1", file())).toEqual({
      ok: false,
      error: RECEIPT_MESSAGES.failed,
    });
    expect(pendings).toHaveLength(0);
    expect(stored).toHaveLength(0);
  });

  it.each([
    ["não é comprovante", { is_receipt: false }, RECEIPT_MESSAGES.notReceipt],
    ["valor ilegível", { amount: "abc" }, RECEIPT_MESSAGES.unreadable],
    ["data estranha", { date: "2026-02-31" }, RECEIPT_MESSAGES.badDate],
  ])("%s: explica e não guarda nada", async (_label, change, message) => {
    const { service, pendings, stored } = setup({ ...EXTRACTION, ...change });

    expect(await service.sendReceipt("user-1", file())).toEqual({ ok: false, error: message });
    expect(pendings).toHaveLength(0);
    expect(stored).toHaveLength(0);
  });

  it("aplica as categorias que a pessoa já ensinou", async () => {
    const { service, pendings } = createFakeChat({
      extraction: EXTRACTION,
      learned: { "mercado exemplo": "Lazer" },
    });

    await service.sendReceipt("user-1", file());

    expect(pendings[0].transaction.category).toBe("Lazer");
  });

  it("um comprovante novo substitui o anterior: só existe uma pendência por pessoa", async () => {
    const { service, pendings } = setup();

    await service.sendReceipt("user-1", file());
    const first = pendings[0].id;
    await service.sendReceipt("user-1", file());

    expect(pendings).toHaveLength(1);
    expect(pendings[0].id).not.toBe(first);
  });

  it("nunca loga o conteúdo do erro", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fake = setup();
    fake.deps.extractReceipt = async () => {
      throw new Error("falha com R$ 999 pra fulano");
    };

    const result = await createChatService(fake.deps).sendReceipt("user-1", file());

    expect(result).toEqual({ ok: false, error: RECEIPT_MESSAGES.failed });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("fulano");
    errorSpy.mockRestore();
  });
});

describe("confirmPending (Salvar)", () => {
  async function withPending() {
    const fake = setup();
    await fake.service.sendReceipt("user-1", file());
    return { ...fake, pendingId: fake.pendings[0].id };
  }

  it("só agora grava a transação, com a fonte 'image', e mostra o saldo", async () => {
    const { service, inserted, pendingId } = await withPending();

    const result = await service.confirmPending("user-1", pendingId);

    expect(inserted).toEqual([
      {
        userId: "user-1",
        source: "image",
        transaction: {
          type: "expense",
          amountCents: 4590,
          description: "mercado exemplo ltda",
          category: "Mercado",
          occurredOn: "2026-09-14",
        },
      },
    ]);
    expect(result).toEqual({
      ok: true,
      botText:
        "✅ R$ 45,90 em Mercado (mercado exemplo ltda)\nSetembro: entrou R$ 1.500,00 · saiu R$ 90,90 · saldo R$ 1.409,10",
      balanceLine: "Setembro: entrou R$ 1.500,00 · saiu R$ 90,90 · saldo R$ 1.409,10",
    });
  });

  it("apaga a pendência e registra a resposta no histórico", async () => {
    const { service, pendings, stored, pendingId } = await withPending();

    await service.confirmPending("user-1", pendingId);

    expect(pendings).toHaveLength(0);
    expect(stored.at(-1)).toMatchObject({ role: "bot" });
    expect(stored.at(-1)?.text).toContain("✅ R$ 45,90 em Mercado");
  });

  it("toque duplo: a segunda confirmação não grava de novo", async () => {
    const { service, inserted, pendingId } = await withPending();

    const [first, second] = await Promise.all([
      service.confirmPending("user-1", pendingId),
      service.confirmPending("user-1", pendingId),
    ]);

    expect([first.ok, second.ok].sort()).toEqual([false, true]);
    expect(inserted).toHaveLength(1);
  });

  it("pendência de outra pessoa não pode ser confirmada", async () => {
    const { service, inserted, pendings, pendingId } = await withPending();

    const result = await service.confirmPending("user-2", pendingId);

    expect(result).toEqual({ ok: false, error: RECEIPT_MESSAGES.alreadyHandled });
    expect(inserted).toHaveLength(0);
    expect(pendings).toHaveLength(1);
  });

  it("depois de 24 horas a pendência expira e não grava", async () => {
    const { service, inserted, clock, pendingId } = await withPending();
    clock.now = new Date(clock.now.getTime() + 24 * 60 * 60 * 1000 + 1000);

    const result = await service.confirmPending("user-1", pendingId);

    expect(result).toEqual({ ok: false, error: RECEIPT_MESSAGES.alreadyHandled });
    expect(inserted).toHaveLength(0);
  });

  it("id que não existe: avisa sem gravar nada", async () => {
    const { service, inserted } = await withPending();

    const result = await service.confirmPending("user-1", "00000000-0000-4000-8000-0000000000ff");

    expect(result).toEqual({ ok: false, error: RECEIPT_MESSAGES.alreadyHandled });
    expect(inserted).toHaveLength(0);
  });

  it("se gravar falhar, devolve a pendência pra tentar de novo e não perde o comprovante", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { service, control, pendings, inserted, pendingId } = await withPending();
    control.insertError = new Error("banco fora do ar");

    const failed = await service.confirmPending("user-1", pendingId);

    expect(failed).toEqual({
      ok: false,
      error: "Não consegui salvar agora. Tente de novo em instantes.",
    });
    expect(inserted).toHaveLength(0);
    expect(pendings).toHaveLength(1);

    control.insertError = null;
    const retry = await service.confirmPending("user-1", pendings[0].id);
    expect(retry.ok).toBe(true);
    expect(inserted).toHaveLength(1);
    errorSpy.mockRestore();
  });
});

describe("cancelPending (Cancelar)", () => {
  it("descarta a pendência sem gravar nada", async () => {
    const fake = setup();
    await fake.service.sendReceipt("user-1", file());

    const result = await fake.service.cancelPending("user-1", fake.pendings[0].id);

    expect(result).toMatchObject({ ok: true, botText: RECEIPT_MESSAGES.cancelled });
    expect(fake.inserted).toHaveLength(0);
    expect(fake.pendings).toHaveLength(0);
    expect(fake.stored.at(-1)?.text).toBe(RECEIPT_MESSAGES.cancelled);
  });

  it("cancelar de novo, ou a pendência de outra pessoa, não faz nada", async () => {
    const fake = setup();
    await fake.service.sendReceipt("user-1", file());
    const id = fake.pendings[0].id;

    expect(await fake.service.cancelPending("user-2", id)).toEqual({
      ok: false,
      error: RECEIPT_MESSAGES.alreadyHandled,
    });
    expect(fake.pendings).toHaveLength(1);

    await fake.service.cancelPending("user-1", id);
    expect(await fake.service.cancelPending("user-1", id)).toEqual({
      ok: false,
      error: RECEIPT_MESSAGES.alreadyHandled,
    });
  });
});

describe("carregar e limpar com pendência", () => {
  it("loadChat devolve a pendência que ainda não expirou", async () => {
    const fake = setup();
    await fake.service.sendReceipt("user-1", file());

    const view = await fake.service.loadChat("user-1");

    expect(view.pending).toEqual({
      id: fake.pendings[0].id,
      summary: "Saída de R$ 45,90 · mercado exemplo ltda · 14/09/2026",
    });
    expect((await fake.service.loadChat("user-2")).pending).toBeNull();
  });

  it("loadChat não mostra pendência expirada", async () => {
    const fake = setup();
    await fake.service.sendReceipt("user-1", file());
    fake.clock.now = new Date(fake.clock.now.getTime() + 25 * 60 * 60 * 1000);

    expect((await fake.service.loadChat("user-1")).pending).toBeNull();
  });

  it("Limpar a conversa também descarta a pendência", async () => {
    const fake = setup();
    await fake.service.sendReceipt("user-1", file());

    await fake.service.clear("user-1");

    expect(fake.pendings).toHaveLength(0);
    expect((await fake.service.loadChat("user-1")).pending).toBeNull();
  });
});
