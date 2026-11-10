import { z } from "zod";

const loginSchema = z.object({
  email: z.email().max(254),
  // Sem regra de força aqui: quem decide a senha é o Supabase. Só barra campo vazio e tamanho absurdo.
  password: z.string().min(1).max(200),
});

export interface LoginCredentials {
  email: string;
  password: string;
}

// Lê o formulário de login. Devolve null se algo estiver faltando ou com formato inválido:
// quem chama mostra sempre a mesma mensagem genérica, sem dizer o que estava errado.
export function parseLoginForm(formData: FormData): LoginCredentials | null {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");
  if (typeof rawEmail !== "string" || typeof rawPassword !== "string") return null;

  const parsed = loginSchema.safeParse({
    email: rawEmail.trim().toLowerCase(),
    password: rawPassword,
  });

  return parsed.success ? parsed.data : null;
}
