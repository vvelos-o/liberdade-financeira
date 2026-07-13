import { and, asc, desc, eq } from "drizzle-orm";
import { qolExpenses } from "../../drizzle/schema";
import { getDb } from "./connection";

export async function getQolExpenses(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(qolExpenses).where(and(eq(qolExpenses.userId, userId), eq(qolExpenses.year, year), eq(qolExpenses.month, month))).orderBy(desc(qolExpenses.transactionDate));
}

export async function getQolExpensesForYear(userId: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(qolExpenses).where(and(eq(qolExpenses.userId, userId), eq(qolExpenses.year, year)));
}

export async function createQolExpense(
  userId: number,
  data: {
    year: number;
    month: number;
    category: "lazer" | "alimentacao" | "transporte" | "saude" | "outros" | "pessoal" | "imprevistos";
    paymentType: "credit_card" | "cash";
    description: string;
    amount: string;
    creditCardId?: number;
    transactionDate: Date;
    pluggyTransactionId?: string;
  }
) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(qolExpenses).values({ userId, ...data });
  return result[0];
}

export async function updateQolExpense(id: number, userId: number, data: Partial<{ description: string; amount: string; category: "lazer" | "alimentacao" | "transporte" | "saude" | "outros" | "pessoal" | "imprevistos"; paymentType: "credit_card" | "cash"; creditCardId: number; transactionDate: Date }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(qolExpenses).set(data).where(and(eq(qolExpenses.id, id), eq(qolExpenses.userId, userId)));
}

export async function deleteQolExpense(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(qolExpenses).where(and(eq(qolExpenses.id, id), eq(qolExpenses.userId, userId)));
}
