"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { RECEIPT_MESSAGES } from "@/core/ai/receipt";
import {
  MAX_CHAT_MESSAGE_LENGTH,
  type ChatMessage,
  type PendingView,
} from "@/core/chat/chat-service";
import {
  cancelReceiptAction,
  clearAppChat,
  confirmReceiptAction,
  sendAppMessage,
  sendReceiptAction,
  signOutAction,
} from "./actions";
import styles from "./chat-app.module.css";
import { prepareReceiptFile } from "./prepare-receipt-file";

interface ChatAppProps {
  userName: string | null;
  initialMessages: ChatMessage[];
  initialBalanceLine: string;
  initialPending: PendingView | null;
}

let localMessageCounter = 0;
function localMessage(role: ChatMessage["role"], text: string): ChatMessage {
  localMessageCounter += 1;
  return { id: `local-${localMessageCounter}`, role, text };
}

export function ChatApp({
  userName,
  initialMessages,
  initialBalanceLine,
  initialPending,
}: ChatAppProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [balanceLine, setBalanceLine] = useState(initialBalanceLine);
  const [pending, setPending] = useState<PendingView | null>(initialPending);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Mantém a última mensagem à vista, como num chat de verdade.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isPending, pending]);

  function addMessage(role: ChatMessage["role"], text: string) {
    setMessages((previous) => [...previous, localMessage(role, text)]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isPending) return;

    setInput("");
    addMessage("user", text);

    startTransition(async () => {
      const result = await sendAppMessage(text);
      if (result.ok) {
        addMessage("bot", result.botText);
        setBalanceLine(result.balanceLine);
      } else {
        addMessage("bot", result.error);
      }
    });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Limpa o campo: assim dá pra escolher o mesmo arquivo de novo depois.
    event.target.value = "";
    if (!file || isPending) return;

    addMessage("user", "📎 Comprovante enviado");

    startTransition(async () => {
      const prepared = await prepareReceiptFile(file);
      if (!prepared) {
        addMessage("bot", RECEIPT_MESSAGES.invalidFile);
        return;
      }

      const formData = new FormData();
      formData.set("file", prepared);
      const result = await sendReceiptAction(formData);

      if (result.ok) {
        addMessage("bot", result.botText);
        setPending(result.pending);
      } else {
        addMessage("bot", result.error);
      }
    });
  }

  function handleConfirm() {
    if (!pending || isPending) return;
    const id = pending.id;

    startTransition(async () => {
      const result = await confirmReceiptAction(id);
      if (result.ok) {
        addMessage("bot", result.botText);
        setBalanceLine(result.balanceLine);
      } else {
        addMessage("bot", result.error);
      }
      setPending(null);
    });
  }

  function handleCancelPending() {
    if (!pending || isPending) return;
    const id = pending.id;

    startTransition(async () => {
      const result = await cancelReceiptAction(id);
      addMessage("bot", result.ok ? result.botText : result.error);
      setPending(null);
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
      setPending(null);
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
          <Link href="/app/resumo" className={`${styles.ghost} ${styles.ghostLink}`}>
            Resumo
          </Link>
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
            <br />
            Ou toque no 📎 e envie a foto ou o PDF de um comprovante.
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

      {pending && (
        <div className={styles.pending} role="group" aria-label="Confirmação do comprovante">
          <p className={styles.pendingText}>{pending.summary}</p>
          <div className={styles.pendingActions}>
            <button
              className={styles.cancel}
              type="button"
              onClick={handleCancelPending}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              className={styles.save}
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      <form className={styles.composer} onSubmit={handleSubmit}>
        <input
          ref={fileRef}
          className={styles.fileInput}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileChange}
          tabIndex={-1}
          aria-hidden="true"
        />
        <button
          className={styles.attach}
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isPending}
          aria-label="Enviar comprovante (foto ou PDF)"
        >
          📎
        </button>
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
