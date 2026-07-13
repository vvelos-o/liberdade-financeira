import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { installmentExpenseMonths, plannedExpenses, pluggyConnections, pluggyTransactions } from "../../drizzle/schema";
import { getDb, DATA_CUTOFF_YEAR, DATA_CUTOFF_MONTH } from "./connection";

export async function getPluggyConnections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pluggyConnections).where(eq(pluggyConnections.userId, userId));
}

export async function upsertPluggyConnection(
  userId: number,
  data: {
    pluggyItemId: string;
    connectorName?: string;
    connectorId?: number;
    status?: "updated" | "updating" | "waiting_user_input" | "login_error" | "outdated" | "error";
    lastSyncAt?: Date;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(pluggyConnections)
    .values({ userId, ...data })
    .onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
}

export async function deletePluggyConnection(pluggyItemId: string, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(pluggyConnections).where(and(eq(pluggyConnections.pluggyItemId, pluggyItemId), eq(pluggyConnections.userId, userId)));
}

export async function getPluggyTransactions(userId: number, year: number, month: number) {
  if (year < DATA_CUTOFF_YEAR || (year === DATA_CUTOFF_YEAR && month < DATA_CUTOFF_MONTH)) return [];
  const db = await getDb();
  if (!db) return [];
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  return db
    .select()
    .from(pluggyTransactions)
    .where(and(eq(pluggyTransactions.userId, userId), gte(pluggyTransactions.transactionDate, startDate), lte(pluggyTransactions.transactionDate, endDate)))
    .orderBy(desc(pluggyTransactions.transactionDate));
}

export async function getRecentPluggyTransactions(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pluggyTransactions).where(eq(pluggyTransactions.userId, userId)).orderBy(desc(pluggyTransactions.transactionDate)).limit(limit);
}

export async function upsertPluggyTransaction(
  userId: number,
  data: {
    pluggyTransactionId: string;
    pluggyItemId: string;
    accountId?: string;
    description: string;
    amount: string;
    type: "debit" | "credit" | "transfer";
    transactionDate: Date;
    category?: "lazer" | "alimentacao" | "transporte" | "saude" | "pessoal" | "imprevistos" | "outros" | "receita" | "fixo" | "investimento" | "nao_categorizado";
  }
) {
  const db = await getDb();
  if (!db) return;
  const categoryValue = data.category ?? "nao_categorizado";
  await db
    .insert(pluggyTransactions)
    .values({ userId, ...data, category: categoryValue })
    .onDuplicateKeyUpdate({
      set: {
        description: data.description,
        amount: data.amount,
        type: data.type,
        category: sql`IF(${pluggyTransactions.isReviewed} = 0, ${categoryValue}, ${pluggyTransactions.category})`,
      },
    });
}

export async function updatePluggyTransactionCategory(
  id: number,
  userId: number,
  category: "lazer" | "alimentacao" | "transporte" | "saude" | "pessoal" | "imprevistos" | "outros" | "receita" | "receita_contabilizada" | "fixo" | "investimento" | "nao_categorizado",
  linkedExpenseId?: number | null,
  linkedExpenseType?: "qol" | "planned" | "installment" | "fixed" | null
) {
  const db = await getDb();
  if (!db) return;

  // Read old linked state BEFORE the update (needed for unlink → mark as unpaid)
  let oldLinkedId: number | null = null;
  let oldLinkedType: string | null = null;
  try {
    const [oldTx] = await db.select({
      linkedExpenseId: pluggyTransactions.linkedExpenseId,
      linkedExpenseType: pluggyTransactions.linkedExpenseType,
    }).from(pluggyTransactions).where(and(eq(pluggyTransactions.id, id), eq(pluggyTransactions.userId, userId)));
    oldLinkedId = oldTx?.linkedExpenseId ?? null;
    oldLinkedType = oldTx?.linkedExpenseType ?? null;
  } catch (e) {
    console.error("[updateCategory] Failed to read old linked state:", e);
  }

  // Perform the core category/link update (MUST succeed)
  await db.update(pluggyTransactions).set({
    category,
    isReviewed: true,
    linkedExpenseId: linkedExpenseId ?? null,
    linkedExpenseType: linkedExpenseType ?? null,
  }).where(and(eq(pluggyTransactions.id, id), eq(pluggyTransactions.userId, userId)));

  // Best-effort: auto-mark planned/installment as paid/unpaid
  try {
    if (oldLinkedId && !linkedExpenseId) {
      if (oldLinkedType === "planned") {
        await db.update(plannedExpenses).set({ isPaid: false })
          .where(and(eq(plannedExpenses.id, oldLinkedId), eq(plannedExpenses.userId, userId)));
      } else if (oldLinkedType === "installment") {
        await db.update(installmentExpenseMonths).set({ isPaid: false })
          .where(and(eq(installmentExpenseMonths.id, oldLinkedId), eq(installmentExpenseMonths.userId, userId)));
      }
    }
    if (linkedExpenseId && linkedExpenseType === "planned") {
      await db.update(plannedExpenses).set({ isPaid: true })
        .where(and(eq(plannedExpenses.id, linkedExpenseId), eq(plannedExpenses.userId, userId)));
    } else if (linkedExpenseId && linkedExpenseType === "installment") {
      await db.update(installmentExpenseMonths).set({ isPaid: true })
        .where(and(eq(installmentExpenseMonths.id, linkedExpenseId), eq(installmentExpenseMonths.userId, userId)));
    }
  } catch (e) {
    console.error("[updateCategory] Failed to update isPaid status:", e);
  }
}

export async function flipPluggyTransactionType(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  const [tx] = await db.select({ type: pluggyTransactions.type })
    .from(pluggyTransactions)
    .where(and(eq(pluggyTransactions.id, id), eq(pluggyTransactions.userId, userId)));
  if (!tx) return;
  const newType = tx.type === "debit" ? "credit" : "debit";
  await db.update(pluggyTransactions).set({ type: newType })
    .where(and(eq(pluggyTransactions.id, id), eq(pluggyTransactions.userId, userId)));
  return { newType };
}
