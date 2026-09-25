import { getMonthTransactions, insertTransactions } from "@/services/supabase/transactions";
import { calculateBalance } from "./balance/calculate-balance";
import { getSaoPauloParts } from "./date/sao-paulo";
import { parseMessage } from "./parser/parse-message";
import { formatBalance, formatConfirmation, formatUnrecognized } from "./replies/format-reply";
import type { CoreInput, CoreReply } from "./types";

export async function handleMessage(input: CoreInput): Promise<CoreReply[]> {
  if (input.kind !== "text") {
    return [{ type: "text", text: "Por enquanto só entendo mensagens de texto." }];
  }

  const parsed = parseMessage(input.content);
  if (!parsed) {
    return [{ type: "text", text: formatUnrecognized() }];
  }

  await insertTransactions(input.userId, parsed, input.source);

  const today = getSaoPauloParts();
  const monthTransactions = await getMonthTransactions(input.userId, today.year, today.month);
  const balance = calculateBalance(monthTransactions);

  const lines = [...parsed.map(formatConfirmation), formatBalance(balance, today)];

  return [{ type: "text", text: lines.join("\n") }];
}
