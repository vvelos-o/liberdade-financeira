import { and, asc, eq } from "drizzle-orm";
import { plannedExpenses } from "../../drizzle/schema";
import { getDb } from "./connection";

export async function getPlannedExpenses(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(plannedExpenses).where(and(eq(plannedExpenses.userId, userId), eq(plannedExpenses.year, year), eq(plannedExpenses.month, month))).orderBy(asc(plannedExpenses.transactionDate));
}

export async function getPlannedExpensesForYear(userId: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(plannedExpenses).where(and(eq(plannedExpenses.userId, userId), eq(plannedExpenses.year, year)));
}

export async function createPlannedExpense(
  userId: number,
  data: {
    description: string;
    amount: string;
    year: number;
    month: number;
    paymentType: "credit_card" | "cash";
    category: "lazer" | "alimentacao" | "transporte" | "saude" | "outros" | "pessoal" | "imprevistos";
    creditCardId?: number;
    transactionDate: Date;
  }
) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(plannedExpenses).values({ userId, ...data });
  return result[0];
}

export async function updatePlannedExpense(id: number, userId: number, data: Partial<{ description: string; amount: string; isPaid: boolean; category: "lazer" | "alimentacao" | "transporte" | "saude" | "outros" | "pessoal" | "imprevistos"; paymentType: "credit_card" | "cash"; creditCardId: number }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(plannedExpenses).set(data).where(and(eq(plannedExpenses.id, id), eq(plannedExpenses.userId, userId)));
}

export async function deletePlannedExpense(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(plannedExpenses).where(and(eq(plannedExpenses.id, id), eq(plannedExpenses.userId, userId)));
}
