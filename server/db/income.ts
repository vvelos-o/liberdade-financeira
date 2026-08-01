import { and, asc, eq } from "drizzle-orm";
import { incomeEntries, incomeSources } from "../../drizzle/schema";
import { getDb } from "./connection";

export async function getIncomeSources(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(incomeSources).where(and(eq(incomeSources.userId, userId), eq(incomeSources.isActive, true))).orderBy(asc(incomeSources.sortOrder));
}

export async function createIncomeSource(userId: number, data: { name: string; type: "fixed" | "variable" | "extra"; sortOrder?: number }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(incomeSources).values({ userId, ...data });
  return { id: (result[0] as any).insertId as number };
}

export async function updateIncomeSource(id: number, userId: number, data: Partial<{ name: string; type: "fixed" | "variable" | "extra"; sortOrder: number; isActive: boolean }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(incomeSources).set(data).where(and(eq(incomeSources.id, id), eq(incomeSources.userId, userId)));
}

export async function deleteIncomeSource(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(incomeSources).set({ isActive: false }).where(and(eq(incomeSources.id, id), eq(incomeSources.userId, userId)));
}

export async function getIncomeEntries(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(incomeEntries).where(and(eq(incomeEntries.userId, userId), eq(incomeEntries.year, year), eq(incomeEntries.month, month)));
}

export async function getIncomeEntriesForYear(userId: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(incomeEntries).where(and(eq(incomeEntries.userId, userId), eq(incomeEntries.year, year)));
}

export async function upsertIncomeEntry(userId: number, sourceId: number, year: number, month: number, amount: string, notes?: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(incomeEntries)
    .values({ userId, sourceId, year, month, amount, notes })
    .onDuplicateKeyUpdate({ set: { amount, notes: notes ?? null } });
}

export async function deleteIncomeEntry(userId: number, sourceId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(incomeEntries).where(and(
    eq(incomeEntries.userId, userId),
    eq(incomeEntries.sourceId, sourceId),
    eq(incomeEntries.year, year),
    eq(incomeEntries.month, month),
  ));
}
