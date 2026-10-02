import type { BalanceTransaction } from "./balance/calculate-balance";
import { calculateBalance } from "./balance/calculate-balance";
import { getSaoPauloParts } from "./date/sao-paulo";
import { parseMessage } from "./parser/parse-message";
import { formatBalance, formatConfirmation, formatUnrecognized } from "./replies/format-reply";
import type { CoreInput, CoreReply, ParsedTransaction, TransactionSource } from "./types";

// Tudo que o núcleo precisa do "mundo de fora" (banco, relógio) entra por aqui.
// Em produção vêm dos serviços reais (handle-message.ts); nos testes, de versões em memória.
export interface CoreDeps {
  insertTransactions(
    userId: string,
    transactions: ParsedTransaction[],
    source: TransactionSource,
  ): Promise<void>;
  getMonthTransactions(userId: string, year: number, month: number): Promise<BalanceTransaction[]>;
  now(): Date;
}

export function createMessageHandler(deps: CoreDeps) {
  return async function handleMessage(input: CoreInput): Promise<CoreReply[]> {
    if (input.kind !== "text") {
      return [{ type: "text", text: "Por enquanto só entendo mensagens de texto." }];
    }

    const now = deps.now();
    const parsed = parseMessage(input.content, now);
    if (!parsed) {
      return [{ type: "text", text: formatUnrecognized() }];
    }

    await deps.insertTransactions(input.userId, parsed, input.source);

    const today = getSaoPauloParts(now);
    const monthTransactions = await deps.getMonthTransactions(
      input.userId,
      today.year,
      today.month,
    );
    const balance = calculateBalance(monthTransactions);

    const lines = [...parsed.map(formatConfirmation), formatBalance(balance, today)];

    return [{ type: "text", text: lines.join("\n") }];
  };
}
