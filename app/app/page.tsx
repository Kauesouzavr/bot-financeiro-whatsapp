import type { Metadata } from "next";
import { ChatApp } from "@/channels/app/chat-app";
import { chatService } from "@/channels/app/chat";
import { requireAppUser } from "@/services/auth/current-user";

export const metadata: Metadata = {
  title: "Bot Financeiro",
  robots: { index: false, follow: false },
};

// Ler um comprovante com a IA pode demorar mais que uma página comum.
export const maxDuration = 30;

export default async function AppPage() {
  // Sem usuário válido, esta linha redireciona e o resto nunca roda.
  const user = await requireAppUser();
  const chat = await chatService.loadChat(user.id);

  return (
    <ChatApp
      userName={user.name}
      initialMessages={chat.messages}
      initialBalanceLine={chat.balanceLine}
      initialPending={chat.pending}
    />
  );
}
