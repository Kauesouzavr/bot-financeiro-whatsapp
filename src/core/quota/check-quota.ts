export interface QuotaDecision {
  shouldSend: boolean;
  warn: boolean;
}

// `repliesSentSoFar` é a contagem ANTES desta resposta.
// Ao atingir o limite, entra em modo silencioso (shouldSend = false): o bot
// continua registrando as transações, só para de responder até o mês virar.
// Ao chegar em 90% do limite, avisa o usuário junto com a resposta (warn = true).
export function checkQuota(repliesSentSoFar: number, monthlyLimit: number): QuotaDecision {
  if (repliesSentSoFar >= monthlyLimit) {
    return { shouldSend: false, warn: false };
  }

  const repliesSentAfterThis = repliesSentSoFar + 1;
  const warn = repliesSentAfterThis >= monthlyLimit * 0.9;

  return { shouldSend: true, warn };
}
