"use client";

import { useActionState } from "react";
import styles from "@/channels/app/auth.module.css";
import { signIn, type LoginState } from "./actions";

const INITIAL_STATE: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, INITIAL_STATE);

  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.logo} aria-hidden="true">
          R$
        </div>
        <h1 className={styles.title}>Bot Financeiro</h1>
        <p className={styles.text}>Entre para registrar e acompanhar os seus gastos.</p>

        <form className={styles.form} action={formAction}>
          <label className={styles.label}>
            E-mail
            <input
              className={styles.input}
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              required
              maxLength={254}
            />
          </label>
          <label className={styles.label}>
            Senha
            <input
              className={styles.input}
              type="password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={200}
            />
          </label>
          {state.error && (
            <p className={styles.error} role="alert">
              {state.error}
            </p>
          )}
          <button className={styles.button} type="submit" disabled={isPending}>
            {isPending ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
