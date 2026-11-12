import { beforeEach, describe, expect, it, vi } from "vitest";

interface Call {
  method: string;
  args: unknown[];
}

// Banco falso: guarda cada chamada encadeada (.from().select().eq()...) e responde com `result`.
const fake = vi.hoisted(() => ({
  calls: [] as Call[],
  result: { data: [] as unknown[], error: null as unknown },
}));

vi.mock("@/services/supabase/admin", () => {
  const query: object = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "then") {
          return (resolve: (value: unknown) => void) => resolve(fake.result);
        }
        return (...args: unknown[]) => {
          fake.calls.push({ method: String(property), args });
          return query;
        };
      },
    },
  );

  return {
    supabaseAdmin: {
      from(table: string) {
        fake.calls.push({ method: "from", args: [table] });
        return query;
      },
    },
  };
});

import { getBudgets, removeBudget, setBudget } from "@/services/supabase/budgets";

function callsOf(method: string): unknown[][] {
  return fake.calls.filter((call) => call.method === method).map((call) => call.args);
}

beforeEach(() => {
  fake.calls = [];
  fake.result = { data: [], error: null };
});

describe("getBudgets", () => {
  it("só lê os orçamentos do usuário pedido", async () => {
    await getBudgets("user-a");

    expect(callsOf("from")).toEqual([["budgets"]]);
    expect(callsOf("eq")).toEqual([["user_id", "user-a"]]);
  });

  it("converte as linhas do banco para o formato do núcleo", async () => {
    fake.result = {
      data: [
        { category: "Delivery", limit_cents: 30000 },
        { category: "Mercado", limit_cents: 80050 },
      ],
      error: null,
    };

    expect(await getBudgets("user-a")).toEqual([
      { category: "Delivery", limitCents: 30000 },
      { category: "Mercado", limitCents: 80050 },
    ]);
  });

  it("devolve lista vazia quando não há orçamentos", async () => {
    expect(await getBudgets("user-a")).toEqual([]);
  });

  it("repassa o erro do banco (quem chama decide o que fazer)", async () => {
    const failure = new Error("falha");
    fake.result = { data: [], error: failure };

    await expect(getBudgets("user-a")).rejects.toBe(failure);
  });
});

describe("setBudget", () => {
  it("grava um limite por usuário e categoria: definir de novo troca o valor", async () => {
    await setBudget("user-a", "Delivery", 30000);

    expect(callsOf("from")).toEqual([["budgets"]]);
    const [row, options] = callsOf("upsert")[0];
    expect(row).toMatchObject({ user_id: "user-a", category: "Delivery", limit_cents: 30000 });
    expect(options).toEqual({ onConflict: "user_id,category" });
  });

  it("repassa o erro do banco", async () => {
    const failure = new Error("falha");
    fake.result = { data: [], error: failure };

    await expect(setBudget("user-a", "Delivery", 30000)).rejects.toBe(failure);
  });
});

describe("removeBudget", () => {
  it("só apaga o orçamento daquela categoria, daquele usuário", async () => {
    await removeBudget("user-a", "Delivery");

    expect(callsOf("delete")).toHaveLength(1);
    expect(callsOf("eq")).toEqual([
      ["user_id", "user-a"],
      ["category", "Delivery"],
    ]);
  });

  it("repassa o erro do banco", async () => {
    const failure = new Error("falha");
    fake.result = { data: [], error: failure };

    await expect(removeBudget("user-a", "Delivery")).rejects.toBe(failure);
  });
});
