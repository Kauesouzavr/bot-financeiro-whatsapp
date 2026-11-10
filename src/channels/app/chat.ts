import { createChatService } from "@/core/chat/chat-service";
import { handleMessage } from "@/core/handle-message";
import { extractReceiptWithGemini } from "@/services/gemini/extract-receipt";
import {
  appendChatMessages,
  clearChatMessages,
  listChatMessages,
} from "@/services/supabase/chat-messages";
import { getLearnedCategories } from "@/services/supabase/learned-categories";
import {
  clearPending,
  getPending,
  replacePending,
  takePending,
} from "@/services/supabase/pending-actions";
import { getMonthTransactions, insertTransactions } from "@/services/supabase/transactions";

// O chat do app, ligado aos serviços reais: o mesmo núcleo que o WhatsApp e o simulador usam.
export const chatService = createChatService({
  handleMessage,
  listMessages: listChatMessages,
  appendMessages: appendChatMessages,
  clearMessages: clearChatMessages,
  getMonthTransactions,
  getLearnedCategories,
  insertTransactions,
  extractReceipt: extractReceiptWithGemini,
  replacePending,
  getPending,
  takePending,
  clearPending,
  now: () => new Date(),
});
