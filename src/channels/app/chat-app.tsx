"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { MAX_CHAT_MESSAGE_LENGTH, type ChatMessage } from "@/core/chat/chat-service";
import { clearAppChat, sendAppMessage, signOutAction } from "./actions";
import styles from "./chat-app.module.css";

interface ChatAppProps {
  userName: string | null;
  initialMessages: ChatMessage[];
  initialBalanceLine: string;
}

let localMessageCounter = 0;
function localMessage(role: ChatMessage["role"], text: string): ChatMessage {
  localMessageCounter += 1;
  return { id: `local-${localMessageCounter}`, role, text };
}

export function ChatApp({ userName, initialMessages, initialBalanceLine }: ChatAppProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [balanceLine, setBalanceLine] = useState(initialBalanceLine);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  // Mantém a última mensagem à vista, como num chat de verdade.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isPending]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isPending) return;

    setInput("");
    setMessages((previous) => [...previous, localMessage("user", text)]);

    startTransition(async () => {
      const result = await sendAppMessage(text);
      if (result.ok) {
        setMessages((previous) => [...previous, localMessage("bot", result.botText)]);
        setBalanceLine(result.balanceLine);
      } else {
        setMessages((previous) => [...previous, localMessage("bot", result.error)]);
      }
    });
  }

  function handleClear() {
    const confirmed = window.confirm(
      "Apagar toda a conversa? Os seus registros de gastos NÃO são apagados.",
    );
    if (!confirmed) return;

    startTransition(async () => {
      await clearAppChat();
      setMessages([]);
    });
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Bot Financeiro</h1>
          {userName && <p className={styles.subtitle}>{userName}</p>}
        </div>
        <div className={styles.actions}>
          <button className={styles.ghost} type="button" onClick={handleClear} disabled={isPending}>
            Limpar
          </button>
          <form action={signOutAction}>
            <button className={styles.ghost} type="submit">
              Sair
            </button>
          </form>
        </div>
      </header>

      <p className={styles.balance}>{balanceLine}</p>

      <main className={styles.messages} aria-live="polite">
        {messages.length === 0 && !isPending && (
          <p className={styles.empty}>
            Escreva como no WhatsApp:
            <br />
            &quot;gastei 45 no ifood&quot;
            <br />
            &quot;recebi 1500 salário&quot;
            <br />
            &quot;muda pra lazer&quot; · &quot;apaga o último&quot;
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.bubble} ${message.role === "user" ? styles.user : styles.bot}`}
          >
            {message.text}
          </div>
        ))}
        {isPending && <div className={`${styles.bubble} ${styles.bot} ${styles.typing}`}>…</div>}
        <div ref={endRef} />
      </main>

      <form className={styles.composer} onSubmit={handleSubmit}>
        <input
          className={styles.field}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Mensagem"
          aria-label="Mensagem"
          maxLength={MAX_CHAT_MESSAGE_LENGTH}
          autoComplete="off"
          enterKeyHint="send"
        />
        <button className={styles.send} type="submit" disabled={isPending || !input.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
