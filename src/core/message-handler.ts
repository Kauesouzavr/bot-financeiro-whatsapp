import { extractionToTransactions, type AiExtraction } from "./ai/extraction";
import type { BalanceTransaction } from "./balance/calculate-balance";
import { calculateBalance } from "./balance/calculate-balance";
import { findCategory, type LearnedCategories } from "./categories";
import { parseCommand, type Command } from "./commands/parse-command";
import { getSaoPauloParts } from "./date/sao-paulo";
import { parseMessage } from "./parser/parse-message";
import {
  formatBalance,
  formatCategoryChanged,
  formatConfirmation,
  formatDeleted,
  formatNoTransactions,
  formatUnknownCategory,
  formatUnrecognized,
} from "./replies/format-reply";
import type {
  CoreInput,
  CoreReply,
  ParsedTransaction,
  StoredTransaction,
  TransactionSource,
} from "./types";

// Tudo que o núcleo precisa do "mundo de fora" (banco, relógio) entra por aqui.
// Em produção vêm dos serviços reais (handle-message.ts); nos testes, de versões em memória.
export interface CoreDeps {
  insertTransactions(
    userId: string,
    transactions: ParsedTransaction[],
    source: TransactionSource,
  ): Promise<void>;
  getMonthTransactions(userId: string, year: number, month: number): Promise<BalanceTransaction[]>;
  getLastTransaction(userId: string): Promise<StoredTransaction | null>;
  updateTransactionCategory(userId: string, transactionId: string, category: string): Promise<void>;
  deleteTransaction(userId: string, transactionId: string): Promise<void>;
  getLearnedCategories(userId: string): Promise<LearnedCategories>;
  saveLearnedCategory(userId: string, term: string, category: string): Promise<void>;
  // IA de reserva: devolve null se estiver indisponível ou falhar (nunca deve lançar erro).
  extractWithAi(message: string): Promise<AiExtraction | null>;
  now(): Date;
}

function textReply(text: string): CoreReply[] {
  return [{ type: "text", text }];
}

export function createMessageHandler(deps: CoreDeps) {
  async function monthBalanceLine(userId: string, now: Date): Promise<string> {
    const today = getSaoPauloParts(now);
    const monthTransactions = await deps.getMonthTransactions(userId, today.year, today.month);
    return formatBalance(calculateBalance(monthTransactions), today);
  }

  // Corrige ou apaga sempre a última transação do usuário.
  async function handleCommand(command: Command, userId: string, now: Date): Promise<CoreReply[]> {
    const last = await deps.getLastTransaction(userId);
    if (!last) return textReply(formatNoTransactions());

    if (command.kind === "delete_last") {
      await deps.deleteTransaction(userId, last.id);
      const balanceLine = await monthBalanceLine(userId, now);
      return textReply([formatDeleted(last), balanceLine].join("\n"));
    }

    const category = findCategory(command.categoryText, last.type);
    if (!category) return textReply(formatUnknownCategory(command.categoryText, last.type));

    await deps.updateTransactionCategory(userId, last.id, category);

    // Só dá pra aprender se a transação tem descrição: é ela o "termo" que vai valer da próxima vez.
    const learnedTerm = last.description?.trim().toLowerCase() || null;
    if (learnedTerm) await deps.saveLearnedCategory(userId, learnedTerm, category);

    return textReply(formatCategoryChanged({ ...last, category }, learnedTerm));
  }

  return async function handleMessage(input: CoreInput): Promise<CoreReply[]> {
    if (input.kind !== "text") {
      return textReply("Por enquanto só entendo mensagens de texto.");
    }

    const now = deps.now();

    // Comandos primeiro: são frases exatas e não têm valor, então nunca devem cair no parser.
    const command = parseCommand(input.content);
    if (command) return handleCommand(command, input.userId, now);

    const learned = await deps.getLearnedCategories(input.userId);

    // Ordem: regras primeiro; a IA só entra quando o parser não entendeu.
    let parsed = parseMessage(input.content, now, learned);
    if (!parsed) {
      const extraction = await deps.extractWithAi(input.content);
      parsed = extraction ? extractionToTransactions(extraction, learned, now) : null;
    }
    if (!parsed) return textReply(formatUnrecognized());

    await deps.insertTransactions(input.userId, parsed, input.source);

    const balanceLine = await monthBalanceLine(input.userId, now);
    const lines = [...parsed.map(formatConfirmation), balanceLine];

    return textReply(lines.join("\n"));
  };
}
