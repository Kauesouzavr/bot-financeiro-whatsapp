type SimulatorEnv = {
  NODE_ENV?: string;
  SIMULATOR_ENABLED?: string;
};

// O simulador grava no Supabase de verdade e não tem login nem limite de uso,
// então só fica ligado fora de produção (npm run dev). Em produção (Vercel,
// inclusive previews) ele responde 404, a não ser que SIMULATOR_ENABLED=true
// seja configurado de propósito.
export function isSimulatorEnabled(env: SimulatorEnv = process.env): boolean {
  return env.NODE_ENV !== "production" || env.SIMULATOR_ENABLED === "true";
}

// Limite de tamanho da mensagem: o parser não precisa de mais que isso e
// evita que alguém mande um texto gigante para o núcleo.
export const SIMULATOR_MAX_LENGTH = 500;
