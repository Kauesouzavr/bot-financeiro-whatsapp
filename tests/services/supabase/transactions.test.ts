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

import { getMonthStatement, getMonthTransactions } from "@/services/supabase/transactions";

function callsOf(method: string): unknown[][] {
  return fake.calls.filter((call) => call.method === method).map((call) => call.args);
}

beforeEach(() => {
  fake.calls = [];
  fake.result = { data: [], error: null };
});

describe("getMonthStatement", () => {
  it("só lê as transações do usuário pedido", async () => {
    await getMonthStatement("user-a", 2026, 11);

    expect(callsOf("from")).toEqual([["transactions"]]);
    expect(callsOf("eq")).toEqual([["user_id", "user-a"]]);
  });

  it("filtra do dia 1 do mês até o dia 1 do mês seguinte, sem incluir o seguinte", async () => {
    await getMonthStatement("user-a", 2026, 12);

    expect(callsOf("gte")).toEqual([["occurred_on", "2026-12-01"]]);
    expect(callsOf("lt")).toEqual([["occurred_on", "2027-01-01"]]);
  });

  it("ordena da data mais recente para a mais antiga e, no mesmo dia, pela ordem de inserção", async () => {
    await getMonthStatement("user-a", 2026, 11);

    expect(callsOf("order")).toEqual([
      ["occurred_on", { ascending: false }],
      ["seq", { ascending: false }],
    ]);
  });

  it("limita a consulta ao máximo que o Supabase devolve", async () => {
    await getMonthStatement("user-a", 2026, 11);

    expect(callsOf("limit")).toEqual([[1000]]);
  });

  it("converte as linhas do banco para o formato do núcleo", async () => {
    fake.result = {
      data: [
        {
          id: "t1",
          type: "expense",
          amount_cents: 4500,
          description: "ifood",
          category: "Delivery",
          occurred_on: "2026-11-05",
        },
        {
          id: "t2",
          type: "income",
          amount_cents: 150000,
          description: null,
          category: "Salário",
          occurred_on: "2026-11-01",
        },
      ],
      error: null,
    };

    expect(await getMonthStatement("user-a", 2026, 11)).toEqual([
      {
        id: "t1",
        type: "expense",
        amountCents: 4500,
        description: "ifood",
        category: "Delivery",
        occurredOn: "2026-11-05",
      },
      {
        id: "t2",
        type: "income",
        amountCents: 150000,
        description: null,
        category: "Salário",
        occurredOn: "2026-11-01",
      },
    ]);
  });

  it("devolve lista vazia quando o mês não tem nada", async () => {
    expect(await getMonthStatement("user-a", 2026, 11)).toEqual([]);
  });

  it("repassa o erro do banco em vez de mostrar um resumo vazio", async () => {
    const failure = new Error("falha");
    fake.result = { data: [], error: failure };

    await expect(getMonthStatement("user-a", 2026, 11)).rejects.toBe(failure);
  });
});

describe("getMonthTransactions", () => {
  it("continua filtrando por usuário e pelo intervalo do mês", async () => {
    fake.result = { data: [{ type: "expense", amount_cents: 500 }], error: null };

    const result = await getMonthTransactions("user-b", 2026, 1);

    expect(callsOf("eq")).toEqual([["user_id", "user-b"]]);
    expect(callsOf("gte")).toEqual([["occurred_on", "2026-01-01"]]);
    expect(callsOf("lt")).toEqual([["occurred_on", "2026-02-01"]]);
    expect(result).toEqual([{ type: "expense", amountCents: 500 }]);
  });
});
