import { extractionToTransactions, type AiExtraction } from "./ai/extraction";
import { calculateBalance } from "./balance/calculate-balance";
import { getBudgetAlertLines } from "./budgets/budget-alerts";
import {
  MAX_BUDGET_CENTS,
  calculateBudgetStatuses,
  type Budget,
  type CategorizedTransaction,
} from "./budgets/budget-status";
import {
  formatBudgetAmountTooHigh,
  formatBudgetList,
  formatBudgetNotFound,
  formatBudgetRemoved,
  formatBudgetSet,
  formatInvalidBudgetAmount,
} from "./budgets/format-budget";
import { findCategory, type LearnedCategories } from "./categories";
import { parseCommand, type BudgetCommand, type Command } from "./commands/parse-command";
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
  getMonthTransactions(
    userId: string,
    year: number,
    month: number,
  ): Promise<CategorizedTransaction[]>;
  getLastTransaction(userId: string): Promise<StoredTransaction | null>;
  updateTransactionCategory(userId: string, transactionId: string, category: string): Promise<void>;
  deleteTransaction(userId: string, transactionId: string): Promise<void>;
  getLearnedCategories(userId: string): Promise<LearnedCategories>;
  saveLearnedCategory(userId: string, term: string, category: string): Promise<void>;
  getBudgets(userId: string): Promise<Budget[]>;
  // Define ou troca o limite da categoria (um por usuário e categoria).
  setBudget(userId: string, category: string, limitCents: number): Promise<void>;
  removeBudget(userId: string, category: string): Promise<void>;
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

  // Orçamentos não dependem da última transação: cada comando age só nos limites do próprio usuário.
  async function handleBudgetCommand(
    command: BudgetCommand,
    userId: string,
    now: Date,
  ): Promise<CoreReply[]> {
    const today = getSaoPauloParts(now);

    if (command.kind === "list_budgets") {
      const [budgets, monthTransactions] = await Promise.all([
        deps.getBudgets(userId),
        deps.getMonthTransactions(userId, today.year, today.month),
      ]);
      return textReply(
        formatBudgetList(calculateBudgetStatuses(budgets, monthTransactions), today),
      );
    }

    // Só gasto tem orçamento: uma categoria de entrada ("salário") cai no mesmo aviso de categoria desconhecida.
    const category = findCategory(command.categoryText, "expense");
    if (!category) return textReply(formatUnknownCategory(command.categoryText, "expense"));

    if (command.kind === "remove_budget") {
      const budgets = await deps.getBudgets(userId);
      if (!budgets.some((budget) => budget.category === category)) {
        return textReply(formatBudgetNotFound(category));
      }
      await deps.removeBudget(userId, category);
      return textReply(formatBudgetRemoved(category));
    }

    if (command.amountCents <= 0) return textReply(formatInvalidBudgetAmount());
    if (command.amountCents > MAX_BUDGET_CENTS) return textReply(formatBudgetAmountTooHigh());

    await deps.setBudget(userId, category, command.amountCents);
    const monthTransactions = await deps.getMonthTransactions(userId, today.year, today.month);
    const [status] = calculateBudgetStatuses(
      [{ category, limitCents: command.amountCents }],
      monthTransactions,
    );
    return textReply(formatBudgetSet(status));
  }

  // Corrige ou apaga sempre a última transação do usuário.
  async function handleCommand(command: Command, userId: string, now: Date): Promise<CoreReply[]> {
    if (
      command.kind === "set_budget" ||
      command.kind === "remove_budget" ||
      command.kind === "list_budgets"
    ) {
      return handleBudgetCommand(command, userId, now);
    }

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

    // Uma consulta só alimenta o saldo e os avisos de orçamento. Tudo vai na MESMA resposta
    // (a cota grátis da Meta conta respostas, não linhas).
    const today = getSaoPauloParts(now);
    const monthTransactions = await deps.getMonthTransactions(
      input.userId,
      today.year,
      today.month,
    );
    const budgetAlerts = await getBudgetAlertLines({
      loadBudgets: () => deps.getBudgets(input.userId),
      monthTransactions,
      saved: parsed,
      month: today,
    });
    const balanceLine = formatBalance(calculateBalance(monthTransactions), today);
    const lines = [...parsed.map(formatConfirmation), ...budgetAlerts, balanceLine];

    return textReply(lines.join("\n"));
  };
}
