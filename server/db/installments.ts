import { and, desc, eq } from "drizzle-orm";
import { installmentExpenseMonths, installmentExpenses } from "../../drizzle/schema";
import { getDb } from "./connection";

export async function getInstallmentExpenses(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(installmentExpenses).where(and(eq(installmentExpenses.userId, userId), eq(installmentExpenses.isActive, true))).orderBy(desc(installmentExpenses.createdAt));
}

export async function getInstallmentMonthsForPeriod(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(installmentExpenseMonths).where(and(eq(installmentExpenseMonths.userId, userId), eq(installmentExpenseMonths.year, year), eq(installmentExpenseMonths.month, month)));
}

export async function getInstallmentMonthsForYear(userId: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(installmentExpenseMonths).where(and(eq(installmentExpenseMonths.userId, userId), eq(installmentExpenseMonths.year, year)));
}

export async function createInstallmentExpense(
  userId: number,
  data: {
    description: string;
    totalAmount: string;
    installmentAmount: string;
    totalInstallments: number;
    startYear: number;
    startMonth: number;
    creditCardId?: number;
    category: "lazer" | "alimentacao" | "transporte" | "saude" | "outros" | "pessoal" | "imprevistos";
  }
) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(installmentExpenses).values({ userId, ...data });
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;

  // Propagate months automatically
  const months = [];
  for (let i = 0; i < data.totalInstallments; i++) {
    let m = data.startMonth + i;
    let y = data.startYear;
    while (m > 12) { m -= 12; y++; }
    months.push({
      installmentExpenseId: insertId,
      userId,
      year: y,
      month: m,
      installmentNumber: i + 1,
      amount: data.installmentAmount,
    });
  }
  if (months.length > 0) {
    await db.insert(installmentExpenseMonths).values(months);
  }
  return insertId;
}

export async function markInstallmentMonthPaid(id: number, userId: number, isPaid: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(installmentExpenseMonths).set({ isPaid }).where(and(eq(installmentExpenseMonths.id, id), eq(installmentExpenseMonths.userId, userId)));
}

export async function deleteInstallmentExpense(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(installmentExpenses).set({ isActive: false }).where(and(eq(installmentExpenses.id, id), eq(installmentExpenses.userId, userId)));
}
