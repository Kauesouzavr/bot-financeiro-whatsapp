import { getMonthTransactions, insertTransactions } from "@/services/supabase/transactions";
import { createMessageHandler } from "./message-handler";

// Ponto de entrada do núcleo para os canais (WhatsApp e simulador):
// o mesmo fluxo de createMessageHandler, ligado aos serviços reais.
export const handleMessage = createMessageHandler({
  insertTransactions,
  getMonthTransactions,
  now: () => new Date(),
});
