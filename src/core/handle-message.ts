import { extractTransactionsWithGroq } from "@/services/groq/extract-transactions";
import { getLearnedCategories, saveLearnedCategory } from "@/services/supabase/learned-categories";
import {
  deleteTransaction,
  getLastTransaction,
  getMonthTransactions,
  insertTransactions,
  updateTransactionCategory,
} from "@/services/supabase/transactions";
import { createMessageHandler } from "./message-handler";

// Ponto de entrada do núcleo para os canais (WhatsApp e simulador):
// o mesmo fluxo de createMessageHandler, ligado aos serviços reais.
export const handleMessage = createMessageHandler({
  insertTransactions,
  getMonthTransactions,
  getLastTransaction,
  updateTransactionCategory,
  deleteTransaction,
  getLearnedCategories,
  saveLearnedCategory,
  extractWithAi: extractTransactionsWithGroq,
  now: () => new Date(),
});
