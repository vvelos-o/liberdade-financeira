import { and, asc, eq } from "drizzle-orm";
import { financialGoals } from "../../drizzle/schema";
import { getDb } from "./connection";

export async function getFinancialGoals(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(financialGoals).where(eq(financialGoals.userId, userId)).orderBy(asc(financialGoals.targetDate));
}

export async function createFinancialGoal(
  userId: number,
  data: {
    title: string;
    targetAmount: string;
    currentAmount?: string;
    targetDate?: Date;
    period?: string;
    notes?: string;
    goalType?: "commitment" | "optional";
    suggestedMonthlyAmount?: string;
  }
) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(financialGoals).values({ userId, ...data });
}

export async function updateFinancialGoal(
  id: number,
  userId: number,
  data: Partial<{
    title: string;
    targetAmount: string;
    currentAmount: string;
    targetDate: Date;
    achievedDate: Date;
    period: string;
    isAchieved: boolean;
    notes: string;
  }>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(financialGoals).set(data).where(and(eq(financialGoals.id, id), eq(financialGoals.userId, userId)));
}

export async function deleteFinancialGoal(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(financialGoals).where(and(eq(financialGoals.id, id), eq(financialGoals.userId, userId)));
}
