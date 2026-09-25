"use client";

import { useTransition, useState, type FormEvent } from "react";
import { sendSimulatorMessage } from "./actions";

interface ChatMessage {
  role: "user" | "bot";
  text: string;
}

export function SimulatorChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");

    startTransition(async () => {
      const reply = await sendSimulatorMessage(text);
      setMessages((prev) => [...prev, { role: "bot", text: reply }]);
    });
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              alignSelf: message.role === "user" ? "flex-end" : "flex-start",
              background: message.role === "user" ? "#dcf8c6" : "#f1f0f0",
              padding: "8px 12px",
              borderRadius: 8,
              whiteSpace: "pre-line",
              maxWidth: "80%",
            }}
          >
            {message.text}
          </div>
        ))}
        {isPending && <div style={{ color: "#888" }}>digitando…</div>}
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ex: gastei 45 no ifood"
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" disabled={isPending}>
          Enviar
        </button>
      </form>
    </div>
  );
}
