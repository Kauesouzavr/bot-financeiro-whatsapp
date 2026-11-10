import { createChatService } from "@/core/chat/chat-service";
import { handleMessage } from "@/core/handle-message";
import {
  appendChatMessages,
  clearChatMessages,
  listChatMessages,
} from "@/services/supabase/chat-messages";
import { getMonthTransactions } from "@/services/supabase/transactions";

// O chat do app, ligado aos serviços reais: o mesmo núcleo que o WhatsApp e o simulador usam.
export const chatService = createChatService({
  handleMessage,
  listMessages: listChatMessages,
  appendMessages: appendChatMessages,
  clearMessages: clearChatMessages,
  getMonthTransactions,
  now: () => new Date(),
});
