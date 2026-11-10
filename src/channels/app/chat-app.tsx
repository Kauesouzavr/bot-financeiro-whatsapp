"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { RECEIPT_MESSAGES } from "@/core/ai/receipt";
import {
  VOICE_MAX_BYTES,
  VOICE_MAX_SECONDS,
  VOICE_MESSAGES,
  VOICE_MIN_SECONDS,
  VOICE_USER_TEXT,
} from "@/core/ai/voice";
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
  sendVoiceAction,
  signOutAction,
} from "./actions";
import styles from "./chat-app.module.css";
import { prepareReceiptFile } from "./prepare-receipt-file";
import {
  formatRecordingTime,
  isVoiceRecordingSupported,
  startVoiceRecording,
  type VoiceRecording,
} from "./voice-recorder";

interface ChatAppProps {
  userName: string | null;
  initialMessages: ChatMessage[];
  initialBalanceLine: string;
  initialPending: PendingView | null;
}

// O navegador não ganha nem perde microfone com a página aberta: não há nada a "assinar".
const subscribeNever = () => () => {};

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

  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recordingRef = useRef<VoiceRecording | null>(null);
  const recordingStartedAt = useRef(0);
  // No servidor e na primeira pintura não há microfone: o botão 🎤 só aparece depois que o navegador confirma.
  const voiceSupported = useSyncExternalStore(
    subscribeNever,
    isVoiceRecordingSupported,
    () => false,
  );

  // Mantém a última mensagem à vista, como num chat de verdade.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isPending, pending]);

  // Cronômetro da gravação.
  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => {
      setSeconds(Math.floor((Date.now() - recordingStartedAt.current) / 1000));
    }, 250);
    return () => clearInterval(timer);
  }, [isRecording]);

  // Se a pessoa sair da tela no meio da gravação, solta o microfone.
  useEffect(() => () => recordingRef.current?.cancel(), []);

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

  async function handleStartRecording() {
    if (isPending || isRecording) return;

    try {
      const recording = await startVoiceRecording(() => handleFinishRecording());
      recordingRef.current = recording;
      recordingStartedAt.current = Date.now();
      setSeconds(0);
      setIsRecording(true);
    } catch {
      // Permissão negada, ou o aparelho não conseguiu gravar.
      addMessage("bot", VOICE_MESSAGES.micDenied);
    }
  }

  function handleCancelRecording() {
    recordingRef.current?.cancel();
    recordingRef.current = null;
    setIsRecording(false);
  }

  // Também é chamada sozinha quando a gravação chega no limite de 1 minuto.
  function handleFinishRecording() {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    setIsRecording(false);

    // Toque sem querer: descarta em vez de gastar uma chamada da IA.
    if ((Date.now() - recordingStartedAt.current) / 1000 < VOICE_MIN_SECONDS) {
      recording.cancel();
      addMessage("bot", VOICE_MESSAGES.tooShort);
      return;
    }

    addMessage("user", VOICE_USER_TEXT);

    startTransition(async () => {
      const file = await recording.stop();
      if (!file || file.size > VOICE_MAX_BYTES) {
        addMessage("bot", VOICE_MESSAGES.invalidFile);
        return;
      }

      const formData = new FormData();
      formData.set("file", file);
      const result = await sendVoiceAction(formData);

      if (result.ok) {
        addMessage("bot", result.botText);
        setBalanceLine(result.balanceLine);
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
          <button
            className={styles.ghost}
            type="button"
            onClick={handleClear}
            disabled={isPending || isRecording}
          >
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
            {voiceSupported && (
              <>
                <br />
                Ou toque no 🎤 e fale o gasto.
              </>
            )}
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

      {isRecording ? (
        <div className={styles.composer} role="group" aria-label="Gravando mensagem de voz">
          <button
            className={styles.mic}
            type="button"
            onClick={handleCancelRecording}
            aria-label="Cancelar gravação"
          >
            ✕
          </button>
          <p className={styles.recording}>
            <span className={styles.recordingDot} aria-hidden="true" />
            Gravando {formatRecordingTime(seconds)} / {formatRecordingTime(VOICE_MAX_SECONDS)}
          </p>
          <button className={styles.send} type="button" onClick={handleFinishRecording}>
            Enviar
          </button>
        </div>
      ) : (
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
          {voiceSupported && (
            <button
              className={styles.mic}
              type="button"
              onClick={handleStartRecording}
              disabled={isPending}
              aria-label="Gravar mensagem de voz"
            >
              🎤
            </button>
          )}
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
      )}
    </div>
  );
}
