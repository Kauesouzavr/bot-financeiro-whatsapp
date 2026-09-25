export type TransactionType = "income" | "expense";
export type TransactionSource = "text" | "audio" | "image" | "simulator";

export interface ParsedTransaction {
  type: TransactionType;
  amountCents: number;
  description: string | null;
  category: string;
  occurredOn: string; // "YYYY-MM-DD"
}

export interface CoreInput {
  userId: string;
  kind: "text" | "audio" | "image" | "button";
  content: string;
  source: TransactionSource;
}

export interface CoreReply {
  type: "text";
  text: string;
}
