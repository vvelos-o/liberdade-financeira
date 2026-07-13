import { and, asc, eq } from "drizzle-orm";
import { fixedExpenseCategories, fixedExpenseEntries } from "../../drizzle/schema";
import { getDb } from "./connection";

export async function getFixedExpenseCategories(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fixedExpenseCategories).where(and(eq(fixedExpenseCategories.userId, userId), eq(fixedExpenseCategories.isActive, true))).orderBy(asc(fixedExpenseCategories.sortOrder));
}

export async function createFixedExpenseCategory(userId: number, data: { name: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(fixedExpenseCategories).values({ userId, ...data });
  return { id: (result[0] as any).insertId as number };
}

export async function updateFixedExpenseCategory(id: number, userId: number, data: Partial<{ name: string; sortOrder: number; isActive: boolean }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(fixedExpenseCategories).set(data).where(and(eq(fixedExpenseCategories.id, id), eq(fixedExpenseCategories.userId, userId)));
}

export async function getFixedExpenseEntries(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fixedExpenseEntries).where(and(eq(fixedExpenseEntries.userId, userId), eq(fixedExpenseEntries.year, year), eq(fixedExpenseEntries.month, month)));
}

export async function getFixedExpenseEntriesForYear(userId: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fixedExpenseEntries).where(and(eq(fixedExpenseEntries.userId, userId), eq(fixedExpenseEntries.year, year)));
}

export async function upsertFixedExpenseEntry(userId: number, categoryId: number, year: number, month: number, amount: string, notes?: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(fixedExpenseEntries)
    .values({ userId, categoryId, year, month, amount, notes })
    .onDuplicateKeyUpdate({ set: { amount, notes: notes ?? null } });
}
