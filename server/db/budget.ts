import { and, eq } from "drizzle-orm";
import { budgetSettings } from "../../drizzle/schema";
import { getDb } from "./connection";

export async function getBudgetSettings(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(budgetSettings)
    .where(and(eq(budgetSettings.userId, userId), eq(budgetSettings.year, year), eq(budgetSettings.month, month)))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertBudgetSettings(
  userId: number,
  year: number,
  month: number,
  data: { baseMonthlyBudget?: string; investmentRate?: string; annualReturnRate?: string; investmentTarget?: string; categoryPercentages?: Record<string, number> }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(budgetSettings)
    .values({ userId, year, month, ...data })
    .onDuplicateKeyUpdate({ set: data });
}
