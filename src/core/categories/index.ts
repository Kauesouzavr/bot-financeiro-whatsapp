import type { TransactionType } from "../types";

export const EXPENSE_CATEGORIES = [
  "Alimentação",
  "Delivery",
  "Mercado",
  "Transporte",
  "Moradia",
  "Contas",
  "Saúde",
  "Lazer",
  "Educação",
  "Compras",
  "Assinaturas",
  "Outros",
] as const;

export const INCOME_CATEGORIES = ["Salário", "Freela", "Pix recebido", "Outras entradas"] as const;

type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

const EXPENSE_KEYWORDS: Record<string, ExpenseCategory> = {
  ifood: "Delivery",
  rappi: "Delivery",

  mercado: "Mercado",
  supermercado: "Mercado",
  feira: "Mercado",
  hortifruti: "Mercado",

  lanche: "Alimentação",
  lanchonete: "Alimentação",
  restaurante: "Alimentação",
  padaria: "Alimentação",
  almoco: "Alimentação",
  almoço: "Alimentação",
  jantar: "Alimentação",
  comida: "Alimentação",

  uber: "Transporte",
  "99": "Transporte",
  taxi: "Transporte",
  táxi: "Transporte",
  onibus: "Transporte",
  ônibus: "Transporte",
  metro: "Transporte",
  metrô: "Transporte",
  gasolina: "Transporte",
  combustivel: "Transporte",
  combustível: "Transporte",

  aluguel: "Moradia",
  condominio: "Moradia",
  condomínio: "Moradia",

  luz: "Contas",
  agua: "Contas",
  água: "Contas",
  internet: "Contas",
  telefone: "Contas",
  celular: "Contas",

  farmacia: "Saúde",
  farmácia: "Saúde",
  remedio: "Saúde",
  remédio: "Saúde",
  medico: "Saúde",
  médico: "Saúde",
  consulta: "Saúde",
  academia: "Saúde",

  cinema: "Lazer",
  bar: "Lazer",
  balada: "Lazer",
  show: "Lazer",
  viagem: "Lazer",

  curso: "Educação",
  faculdade: "Educação",
  livro: "Educação",
  escola: "Educação",

  roupa: "Compras",
  shopping: "Compras",
  loja: "Compras",

  netflix: "Assinaturas",
  spotify: "Assinaturas",
  assinatura: "Assinaturas",
  mensalidade: "Assinaturas",
};

const INCOME_KEYWORDS: Record<string, IncomeCategory> = {
  salario: "Salário",
  salário: "Salário",
  freela: "Freela",
  freelance: "Freela",
  pix: "Pix recebido",
};

export const FALLBACK_CATEGORY: Record<TransactionType, string> = {
  expense: "Outros",
  income: "Outras entradas",
};

// Termo → categoria que o próprio usuário já corrigiu (tabela learned_categories).
export type LearnedCategories = Readonly<Record<string, string>>;

export function categoriesFor(type: TransactionType): readonly string[] {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Acha a categoria oficial a partir do que o usuário digitou ("lazer", "alimentacao", "PIX recebido").
export function findCategory(raw: string, type: TransactionType): string | null {
  const normalize = (text: string) => stripAccents(text).toLowerCase().replace(/\s+/g, " ").trim();
  const wanted = normalize(raw);
  return categoriesFor(type).find((category) => normalize(category) === wanted) ?? null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// O "\b" do JS só entende letras sem acento: com "água" ou "ônibus" a borda da palavra falha.
// Por isso a borda é montada com lookaround de letra/número Unicode.
function containsTerm(text: string, term: string): boolean {
  const pattern = `(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`;
  return new RegExp(pattern, "u").test(text);
}

export function categorize(
  description: string,
  type: TransactionType,
  learned: LearnedCategories = {},
): string {
  const normalized = description.toLowerCase();

  // O que o usuário ensinou ganha do dicionário padrão. Termo mais longo primeiro,
  // pra "ifood lanche" ter prioridade sobre "ifood". Categoria de outro tipo é ignorada.
  const validCategories = categoriesFor(type);
  const learnedTerms = Object.keys(learned).sort((a, b) => b.length - a.length);
  for (const term of learnedTerms) {
    if (validCategories.includes(learned[term]) && containsTerm(normalized, term)) {
      return learned[term];
    }
  }

  const keywords = type === "income" ? INCOME_KEYWORDS : EXPENSE_KEYWORDS;
  for (const [keyword, category] of Object.entries(keywords)) {
    if (containsTerm(normalized, keyword)) return category;
  }

  return FALLBACK_CATEGORY[type];
}
