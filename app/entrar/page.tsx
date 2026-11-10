import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar | Bot Financeiro",
  robots: { index: false, follow: false },
};

export default function EntrarPage() {
  return <LoginForm />;
}
