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

export function categorize(description: string, type: TransactionType): string {
  const normalized = description.toLowerCase();
  const keywords = type === "income" ? INCOME_KEYWORDS : EXPENSE_KEYWORDS;

  for (const [keyword, category] of Object.entries(keywords)) {
    if (new RegExp(`\\b${keyword}\\b`).test(normalized)) return category;
  }

  return type === "income" ? "Outras entradas" : "Outros";
}
