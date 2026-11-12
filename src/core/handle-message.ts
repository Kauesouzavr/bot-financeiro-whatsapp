import { extractTransactionsWithGemini } from "@/services/gemini/extract-transactions";
import { extractTransactionsWithGroq } from "@/services/groq/extract-transactions";
import { getBudgets, removeBudget, setBudget } from "@/services/supabase/budgets";
import { getLearnedCategories, saveLearnedCategory } from "@/services/supabase/learned-categories";
import {
  deleteTransaction,
  getLastTransaction,
  getMonthTransactions,
  insertTransactions,
  updateTransactionCategory,
} from "@/services/supabase/transactions";
import { chainExtractors } from "./ai/fallback-chain";
import { createMessageHandler } from "./message-handler";

// Ponto de entrada do núcleo para os canais (WhatsApp e simulador):
// o mesmo fluxo de createMessageHandler, ligado aos serviços reais.
// IA de reserva: Groq primeiro (não treina com os dados); se ele falhar, Gemini.
export const handleMessage = createMessageHandler({
  insertTransactions,
  getMonthTransactions,
  getLastTransaction,
  updateTransactionCategory,
  deleteTransaction,
  getLearnedCategories,
  saveLearnedCategory,
  getBudgets,
  setBudget,
  removeBudget,
  extractWithAi: chainExtractors([extractTransactionsWithGroq, extractTransactionsWithGemini]),
  now: () => new Date(),
});
