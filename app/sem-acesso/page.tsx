import type { Metadata } from "next";
import { signOutAction } from "@/channels/app/actions";
import styles from "@/channels/app/auth.module.css";

export const metadata: Metadata = {
  title: "Sem acesso | Bot Financeiro",
  robots: { index: false, follow: false },
};

// Quem tem login mas ainda não foi ligado a um usuário ativo do bot cai aqui (e não em /entrar,
// que redirecionaria de volta pro app e criaria um laço).
export default function SemAcessoPage() {
  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.title}>Conta ainda não liberada</h1>
        <p className={styles.text}>
          O seu login existe, mas ainda não foi ligado a um usuário do Bot Financeiro. Peça para
          quem administra o app concluir a liberação e entre de novo.
        </p>
        <form action={signOutAction}>
          <button className={styles.button} type="submit">
            Sair
          </button>
        </form>
      </div>
    </main>
  );
}
