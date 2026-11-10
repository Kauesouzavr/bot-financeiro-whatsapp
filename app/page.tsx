import Link from "next/link";

export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Bot Financeiro</h1>
      <p>Bot de finanças pessoais no WhatsApp.</p>
      <p>
        <Link href="/entrar">Entrar no app</Link>
      </p>
    </main>
  );
}
