import { and, asc, eq } from "drizzle-orm";
import { creditCardMonthly, creditCards } from "../../drizzle/schema";
import { getDb } from "./connection";

export async function getCreditCards(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(creditCards).where(and(eq(creditCards.userId, userId), eq(creditCards.isActive, true))).orderBy(asc(creditCards.id));
}

export async function createCreditCard(userId: number, data: { name: string; lastFourDigits?: string; color?: string }) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(creditCards).values({ userId, ...data });
}

export async function updateCreditCard(id: number, userId: number, data: Partial<{ name: string; lastFourDigits: string; color: string; isActive: boolean }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(creditCards).set(data).where(and(eq(creditCards.id, id), eq(creditCards.userId, userId)));
}

export async function getCreditCardMonthly(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(creditCardMonthly).where(and(eq(creditCardMonthly.userId, userId), eq(creditCardMonthly.year, year), eq(creditCardMonthly.month, month)));
}

export async function upsertCreditCardMonthly(userId: number, creditCardId: number, year: number, month: number, totalAmount: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(creditCardMonthly)
    .values({ userId, creditCardId, year, month, totalAmount })
    .onDuplicateKeyUpdate({ set: { totalAmount } });
}

export async function markCreditCardPaid(creditCardId: number, userId: number, year: number, month: number, isPaid: boolean) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(creditCardMonthly)
    .set({ isPaid, paidAt: isPaid ? new Date() : null })
    .where(and(eq(creditCardMonthly.creditCardId, creditCardId), eq(creditCardMonthly.userId, userId), eq(creditCardMonthly.year, year), eq(creditCardMonthly.month, month)));
}
