import type { AiExtraction } from "./extraction";

export type AiExtractor = (message: string) => Promise<AiExtraction | null>;

// Tenta os provedores de IA em ordem e devolve a primeira resposta válida. `null` significa que o
// provedor falhou (sem chave, limite, erro de rede ou JSON inválido): aí vem o próximo. Uma lista
// vazia de transações é uma resposta válida ("isso não é um registro"), então a corrente para nela
// e não gasta nem expõe a mensagem a um segundo provedor.
export function chainExtractors(extractors: readonly AiExtractor[]): AiExtractor {
  return async (message) => {
    for (const extract of extractors) {
      const result = await extract(message);
      if (result) return result;
    }
    return null;
  };
}
