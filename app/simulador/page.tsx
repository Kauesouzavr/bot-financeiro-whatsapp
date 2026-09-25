import { SimulatorChat } from "@/channels/simulator/simulator-chat";

export default function SimuladorPage() {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "1rem", fontFamily: "sans-serif" }}>
      <h1>Simulador</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Conversa local com o núcleo do bot, usando um usuário de teste.
      </p>
      <SimulatorChat />
    </main>
  );
}
