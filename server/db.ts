import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  budgetSettings,
  creditCardMonthly,
  creditCards,
  financialGoals,
  fixedExpenseCategories,
  fixedExpenseEntries,
  incomeEntries,
  incomeSources,
  installmentExpenseMonths,
  installmentExpenses,
  plannedExpenses,
  pluggyConnections,
  pluggyTransactions,
  qolExpenses,
  users,
  monthlyInsights,
  DEFAULT_CATEGORY_PERCENTAGES,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Data Cutoff ──────────────────────────────────────────────────────────────
// Ignore all Pluggy transactions before this date (user started tracking from July 2026)
export const DATA_CUTOFF_DATE = new Date(2026, 5, 1); // June 1, 2026 (month is 0-indexed)
// For month-based queries, only consider data from July 2026 (year=2026, month>=7)
export const DATA_CUTOFF_YEAR = 2026;
export const DATA_CUTOFF_MONTH = 7;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Budget Settings ──────────────────────────────────────────────────────────

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

// ─── Income ───────────────────────────────────────────────────────────────────

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

// ─── Fixed Expenses ───────────────────────────────────────────────────────────

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

// ─── Quality of Life Expenses ─────────────────────────────────────────────────

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

// ─── Installment Expenses ─────────────────────────────────────────────────────

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

// ─── Planned Expenses ─────────────────────────────────────────────────────────

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

// ─── Credit Cards ─────────────────────────────────────────────────────────────

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

// ─── Financial Goals ──────────────────────────────────────────────────────────

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

// ─── Pluggy ───────────────────────────────────────────────────────────────────

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
  // Ignore data before the cutoff date
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
        // Only update category if the existing row has NOT been reviewed by the user
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
    // If previously linked to planned/installment and now unlinking → mark as unpaid
    if (oldLinkedId && !linkedExpenseId) {
      if (oldLinkedType === "planned") {
        await db.update(plannedExpenses).set({ isPaid: false })
          .where(and(eq(plannedExpenses.id, oldLinkedId), eq(plannedExpenses.userId, userId)));
      } else if (oldLinkedType === "installment") {
        await db.update(installmentExpenseMonths).set({ isPaid: false })
          .where(and(eq(installmentExpenseMonths.id, oldLinkedId), eq(installmentExpenseMonths.userId, userId)));
      }
    }
    // Auto-mark planned expense or installment month as paid when linked
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

// ─── Dashboard Aggregation ────────────────────────────────────────────────────────────────────────────

export async function getDashboardSummary(userId: number, year: number, month: number) {
  // Ignore data before the cutoff date
  if (year < DATA_CUTOFF_YEAR || (year === DATA_CUTOFF_YEAR && month < DATA_CUTOFF_MONTH)) return null;
  const db = await getDb();
  if (!db) return null;

  // Date range for the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // ── Pluggy transactions for this month ──────────────────────────────────────
  // Income from Pluggy: credit transactions categorized as 'receita'
  const pluggyIncomeResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${pluggyTransactions.amount}), 0)` })
    .from(pluggyTransactions)
    .where(
      and(
        eq(pluggyTransactions.userId, userId),
        eq(pluggyTransactions.type, "credit"),
        eq(pluggyTransactions.category, "receita"),
        gte(pluggyTransactions.transactionDate, startDate),
        lte(pluggyTransactions.transactionDate, endDate)
      )
    );

  // Expenses from Pluggy: debit transactions (excluding investimento)
  const pluggyExpenseResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${pluggyTransactions.amount}), 0)` })
    .from(pluggyTransactions)
    .where(
      and(
        eq(pluggyTransactions.userId, userId),
        eq(pluggyTransactions.type, "debit"),
        gte(pluggyTransactions.transactionDate, startDate),
        lte(pluggyTransactions.transactionDate, endDate)
      )
    );

  // Pluggy expenses by category
  const pluggyByCategory = await db
    .select({
      category: pluggyTransactions.category,
      total: sql<string>`COALESCE(SUM(${pluggyTransactions.amount}), 0)`,
    })
    .from(pluggyTransactions)
    .where(
      and(
        eq(pluggyTransactions.userId, userId),
        eq(pluggyTransactions.type, "debit"),
        gte(pluggyTransactions.transactionDate, startDate),
        lte(pluggyTransactions.transactionDate, endDate)
      )
    )
    .groupBy(pluggyTransactions.category);

  // ── Manual entries (kept for backwards compatibility) ────────────────────────
  const incomeResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${incomeEntries.amount}), 0)` })
    .from(incomeEntries)
    .where(and(eq(incomeEntries.userId, userId), eq(incomeEntries.year, year), eq(incomeEntries.month, month)));

  const fixedResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${fixedExpenseEntries.amount}), 0)` })
    .from(fixedExpenseEntries)
    .innerJoin(fixedExpenseCategories, eq(fixedExpenseEntries.categoryId, fixedExpenseCategories.id))
    .where(and(
      eq(fixedExpenseEntries.userId, userId),
      eq(fixedExpenseEntries.year, year),
      eq(fixedExpenseEntries.month, month),
      eq(fixedExpenseCategories.isActive, true)
    ));

  const qolResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${qolExpenses.amount}), 0)` })
    .from(qolExpenses)
    .where(and(eq(qolExpenses.userId, userId), eq(qolExpenses.year, year), eq(qolExpenses.month, month)));

  const qolByCategory = await db
    .select({
      category: qolExpenses.category,
      total: sql<string>`COALESCE(SUM(${qolExpenses.amount}), 0)`,
    })
    .from(qolExpenses)
    .where(and(eq(qolExpenses.userId, userId), eq(qolExpenses.year, year), eq(qolExpenses.month, month)))
    .groupBy(qolExpenses.category);

  const installmentResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${installmentExpenseMonths.amount}), 0)` })
    .from(installmentExpenseMonths)
    .innerJoin(installmentExpenses, eq(installmentExpenseMonths.installmentExpenseId, installmentExpenses.id))
    .where(and(
      eq(installmentExpenseMonths.userId, userId),
      eq(installmentExpenseMonths.year, year),
      eq(installmentExpenseMonths.month, month),
      eq(installmentExpenses.isActive, true)
    ));

  const plannedResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${plannedExpenses.amount}), 0)` })
    .from(plannedExpenses)
    .where(and(eq(plannedExpenses.userId, userId), eq(plannedExpenses.year, year), eq(plannedExpenses.month, month)));

  // Budget settings
  const budget = await getBudgetSettings(userId, year, month);

  // ── Aggregate ────────────────────────────────────────────────────────────────
  const pluggyIncome = parseFloat(pluggyIncomeResult[0]?.total ?? "0");
  const pluggyExpenses = parseFloat(pluggyExpenseResult[0]?.total ?? "0");

  const manualIncome = parseFloat(incomeResult[0]?.total ?? "0");
  const totalFixed = parseFloat(fixedResult[0]?.total ?? "0");
  const totalQol = parseFloat(qolResult[0]?.total ?? "0");
  const totalInstallments = parseFloat(installmentResult[0]?.total ?? "0");
  const totalPlanned = parseFloat(plannedResult[0]?.total ?? "0");

  // Use Pluggy data when available, fall back to manual entries
  const hasPluggyData = pluggyIncome > 0 || pluggyExpenses > 0;
  // Manual income + Pluggy extras (category='receita'); 'receita_contabilizada' is ignored
  const totalIncome = manualIncome + pluggyIncome;
  const totalExpenses = hasPluggyData
    ? pluggyExpenses
    : totalFixed + totalQol + totalInstallments + totalPlanned;
  const balance = totalIncome - totalExpenses;

  const investmentRate = parseFloat(budget?.investmentRate ?? "0.15");
  const annualReturnRate = parseFloat(budget?.annualReturnRate ?? "0.15");
  const fcp = totalIncome * investmentRate * annualReturnRate;

  // Build category breakdown — prefer Pluggy, fall back to manual QoL
  const categoryMap = new Map<string, number>();
  if (hasPluggyData) {
    for (const row of pluggyByCategory) {
      const cat = row.category as string;
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + parseFloat(row.total));
    }
  } else {
    for (const row of qolByCategory) {
      categoryMap.set(row.category, parseFloat(row.total));
    }
  }
  const qolByCategoryResult = Array.from(categoryMap.entries())
    .map(([category, total]) => ({ category, total }))
    .filter((r) => r.total > 0);

  return {
    totalIncome,
    totalFixed: hasPluggyData ? (categoryMap.get("fixo") ?? 0) : totalFixed,
    totalQol: hasPluggyData
      ? ["lazer", "alimentacao", "transporte", "saude", "outros"].reduce((s, c) => s + (categoryMap.get(c) ?? 0), 0)
      : totalQol,
    totalInstallments: hasPluggyData ? 0 : totalInstallments,
    totalPlanned: hasPluggyData ? 0 : totalPlanned,
    totalExpenses,
    balance,
    fcp,
    baseMonthlyBudget: parseFloat(budget?.baseMonthlyBudget ?? "0"),
    investmentRate,
    annualReturnRate,
    hasPluggyData,
    qolByCategory: qolByCategoryResult,
  };
}

// ─── Annual History ───────────────────────────────────────────────────────────

export async function getAnnualQolHistory(userId: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  // If year is before cutoff, return empty
  if (year < DATA_CUTOFF_YEAR) return [];

  // Manual qol_expenses (filter months >= cutoff if same year)
  const qolData = await db
    .select({
      month: qolExpenses.month,
      category: qolExpenses.category,
      total: sql<string>`COALESCE(SUM(${qolExpenses.amount}), 0)`,
    })
    .from(qolExpenses)
    .where(and(
      eq(qolExpenses.userId, userId),
      eq(qolExpenses.year, year),
      ...(year === DATA_CUTOFF_YEAR ? [sql`${qolExpenses.month} >= ${DATA_CUTOFF_MONTH}`] : [])
    ))
    .groupBy(qolExpenses.month, qolExpenses.category);

  // Pluggy transactions (debit, variable categories only, excluding linked transactions)
  // Use cutoff month as start if same year
  const startDate = year === DATA_CUTOFF_YEAR ? new Date(year, DATA_CUTOFF_MONTH - 1, 1) : new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);
  const pluggyData: { month: number; category: string; total: string }[] = await db.execute(
    sql`SELECT MONTH(transactionDate) as month, category, COALESCE(SUM(amount), 0) as total
        FROM pluggy_transactions
        WHERE userId = ${userId} AND type = 'debit'
          AND transactionDate >= ${startDate} AND transactionDate <= ${endDate}
          AND category NOT IN ('receita', 'receita_contabilizada', 'fixo', 'investimento', 'nao_categorizado')
          AND linkedExpenseType IS NULL
        GROUP BY MONTH(transactionDate), category`
  ) as any;

  // Merge both sources
  const merged = new Map<string, { month: number; category: string; total: string }>();
  for (const row of qolData) {
    const key = `${row.month}-${row.category}`;
    merged.set(key, { month: row.month, category: row.category, total: row.total });
  }
  for (const row of pluggyData) {
    const key = `${row.month}-${row.category}`;
    const existing = merged.get(key);
    if (existing) {
      existing.total = String(parseFloat(existing.total) + parseFloat(row.total));
    } else {
      merged.set(key, { month: row.month, category: row.category as string, total: row.total });
    }
  }
  return Array.from(merged.values());
}


// ─── Monthly Insights ────────────────────────────────────────────────────────

export async function getMonthlyInsight(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(monthlyInsights)
    .where(and(eq(monthlyInsights.userId, userId), eq(monthlyInsights.year, year), eq(monthlyInsights.month, month)))
    .limit(1);
  return result[0] ?? null;
}

export async function generateMonthlyInsight(userId: number, year: number, month: number) {
  // Get current month funnel data
  const currentFunnel = await getDashboardFunnel(userId, year, month);
  if (!currentFunnel) return null;

  // Get previous month for comparison (may be null if before cutoff)
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevFunnel = await getDashboardFunnel(userId, prevYear, prevMonth);

  // Build insight based on data comparison
  const { invokeLLM } = await import("./_core/llm");

  const categoriesStr = currentFunnel.categories
    .filter(c => c.spent > 0)
    .map(c => `${c.category}: R$ ${c.spent.toFixed(2)} / R$ ${c.budget.toFixed(2)} (${c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0}%)`)
    .join(", ");

  const prevSection = prevFunnel ? `\nMês anterior (${prevYear}/${prevMonth}):\n- Renda: R$ ${prevFunnel.totalIncome.toFixed(2)}\n- Gastos fixos: R$ ${prevFunnel.totalFixed.toFixed(2)}\n- Disponível: R$ ${prevFunnel.disponivel.toFixed(2)}\n- Categorias: ${prevFunnel.categories.filter(c => c.spent > 0).map(c => `${c.category}: R$ ${c.spent.toFixed(2)}`).join(", ")}` : "(Sem dados do mês anterior para comparação)";

  const prompt = `Você é um consultor financeiro pessoal. Gere UM insight curto e acionável (máximo 2 frases) para o usuário baseado nos dados abaixo.

Mês atual (${year}/${month}):
- Renda total: R$ ${currentFunnel.totalIncome.toFixed(2)} (Fixa: R$ ${currentFunnel.manualFixedIncome.toFixed(2)} + Extras: R$ ${currentFunnel.totalExtraIncome.toFixed(2)})
- Gastos fixos: R$ ${currentFunnel.totalFixed.toFixed(2)}
- Investimento: R$ ${currentFunnel.effectiveInvestment.toFixed(2)} (Meta: R$ ${currentFunnel.investmentTarget.toFixed(2)})
- Compromissos: R$ ${currentFunnel.totalCompromissos.toFixed(2)}
- Disponível para variável: R$ ${currentFunnel.disponivel.toFixed(2)}
- Gastos por categoria: ${categoriesStr}
${prevSection}

Regras:
- Seja específico com valores em R$
- Sugira uma ação concreta
- Use tom amigável mas direto
- Responda APENAS o insight, sem título ou prefixo`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Você é um consultor financeiro pessoal brasileiro. Responda em português." },
        { role: "user", content: prompt },
      ],
    });

    const rawContent = response.choices?.[0]?.message?.content;
    const content = typeof rawContent === "string" ? rawContent : "";
    if (!content) return null;

    const db = await getDb();
    if (!db) return null;

    await db
      .insert(monthlyInsights)
      .values({ userId, year, month, content })
      .onDuplicateKeyUpdate({ set: { content, isDismissed: false } });

    return { content, isDismissed: false };
  } catch (error) {
    console.error("[Insights] Failed to generate:", error);
    return null;
  }
}

export async function dismissMonthlyInsight(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(monthlyInsights)
    .set({ isDismissed: true })
    .where(and(eq(monthlyInsights.userId, userId), eq(monthlyInsights.year, year), eq(monthlyInsights.month, month)));
}

// ─── Dashboard Funnel (new v2 model) ────────────────────────────────────────

export async function getDashboardFunnel(userId: number, year: number, month: number) {
  // Ignore data before the cutoff date
  if (year < DATA_CUTOFF_YEAR || (year === DATA_CUTOFF_YEAR && month < DATA_CUTOFF_MONTH)) return null;
  const db = await getDb();
  if (!db) return null;
  try {

  // 1. Total income - separate fixed from extra manual entries
  // Fixed income (salary, etc.)
  const fixedIncomeResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${incomeEntries.amount}), 0)` })
    .from(incomeEntries)
    .innerJoin(incomeSources, eq(incomeEntries.sourceId, incomeSources.id))
    .where(and(
      eq(incomeEntries.userId, userId),
      eq(incomeEntries.year, year),
      eq(incomeEntries.month, month),
      eq(incomeSources.type, "fixed")
    ));
  const manualFixedIncome = parseFloat(fixedIncomeResult[0]?.total ?? "0");

  // Extra/variable income from manual entries (e.g., restituição)
  const extraIncomeResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${incomeEntries.amount}), 0)` })
    .from(incomeEntries)
    .innerJoin(incomeSources, eq(incomeEntries.sourceId, incomeSources.id))
    .where(and(
      eq(incomeEntries.userId, userId),
      eq(incomeEntries.year, year),
      eq(incomeEntries.month, month),
      inArray(incomeSources.type, ["extra", "variable"])
    ));
  const manualExtraIncome = parseFloat(extraIncomeResult[0]?.total ?? "0");
  const manualIncome = manualFixedIncome + manualExtraIncome;

  // Pluggy "receita" extras: credit transactions categorized as 'receita' (NOT 'receita_contabilizada')
  // These are extra income that the user wants to ADD to their disponível (e.g., friends splitting a bill)
  // 'receita_contabilizada' = already part of manual income (e.g., salary PIX), ignored in calculations
  const incomeStartDate = new Date(year, month - 1, 1);
  const incomeEndDate = new Date(year, month, 0, 23, 59, 59);
  const pluggyExtraIncomeResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${pluggyTransactions.amount}), 0)` })
    .from(pluggyTransactions)
    .where(
      and(
        eq(pluggyTransactions.userId, userId),
        eq(pluggyTransactions.type, "credit"),
        eq(pluggyTransactions.category, "receita"),
        gte(pluggyTransactions.transactionDate, incomeStartDate),
        lte(pluggyTransactions.transactionDate, incomeEndDate)
      )
    );
  const pluggyExtraIncome = parseFloat(pluggyExtraIncomeResult[0]?.total ?? "0");
  // Total income = all manual entries + Pluggy extras (category='receita')
  const totalIncome = manualIncome + pluggyExtraIncome;
  // Total extra = manual extra + pluggy extra (for display breakdown)
  const totalExtraIncome = manualExtraIncome + pluggyExtraIncome;

  // 2. Fixed expenses (ONLY manual entries from ACTIVE categories)
  // Join with categories to exclude entries from deactivated categories
  const fixedResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${fixedExpenseEntries.amount}), 0)` })
    .from(fixedExpenseEntries)
    .innerJoin(fixedExpenseCategories, eq(fixedExpenseEntries.categoryId, fixedExpenseCategories.id))
    .where(and(
      eq(fixedExpenseEntries.userId, userId),
      eq(fixedExpenseEntries.year, year),
      eq(fixedExpenseEntries.month, month),
      eq(fixedExpenseCategories.isActive, true)
    ));
  const totalFixed = parseFloat(fixedResult[0]?.total ?? "0");

  // 3. Budget settings (investment target + category percentages)
  let investmentTarget = 0;
  let categoryPercentages: Record<string, number> = DEFAULT_CATEGORY_PERCENTAGES;
  try {
    const budget = await getBudgetSettings(userId, year, month);
    investmentTarget = parseFloat(budget?.investmentTarget ?? "0");
    const rawPercentages = budget?.categoryPercentages;
    if (rawPercentages && Object.keys(rawPercentages).length > 0) {
      categoryPercentages = rawPercentages;
    }
  } catch (budgetErr) {
    console.error("[getDashboardFunnel] getBudgetSettings failed (using defaults):", budgetErr);
  }

  // 4. Installments for this month (compromissos) - only from ACTIVE installment expenses
  const installmentResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${installmentExpenseMonths.amount}), 0)` })
    .from(installmentExpenseMonths)
    .innerJoin(installmentExpenses, eq(installmentExpenseMonths.installmentExpenseId, installmentExpenses.id))
    .where(and(
      eq(installmentExpenseMonths.userId, userId),
      eq(installmentExpenseMonths.year, year),
      eq(installmentExpenseMonths.month, month),
      eq(installmentExpenses.isActive, true)
    ));
  const totalInstallments = parseFloat(installmentResult[0]?.total ?? "0");

  // 5. Planned expenses for this month (compromissos)
  const plannedResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${plannedExpenses.amount}), 0)` })
    .from(plannedExpenses)
    .where(and(eq(plannedExpenses.userId, userId), eq(plannedExpenses.year, year), eq(plannedExpenses.month, month)));
  const totalPlanned = parseFloat(plannedResult[0]?.total ?? "0");

  const totalCompromissos = totalInstallments + totalPlanned;

  // Date range for this month (used by multiple queries below)
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // 5b. Real investment amount from Pluggy (transactions categorized as 'investimento')
  const investmentRealResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${pluggyTransactions.amount}), 0)` })
    .from(pluggyTransactions)
    .where(
      and(
        eq(pluggyTransactions.userId, userId),
        eq(pluggyTransactions.type, "debit"),
        eq(pluggyTransactions.category, "investimento" as any),
        gte(pluggyTransactions.transactionDate, startDate),
        lte(pluggyTransactions.transactionDate, endDate)
      )
    );
  const realInvestment = parseFloat(investmentRealResult[0]?.total ?? "0");
  // Use the greater of target or actual investment
  const effectiveInvestment = Math.max(investmentTarget, realInvestment);

  // 6. Available for variable spending
  const disponivel = Math.max(0, totalIncome - totalFixed - effectiveInvestment - totalCompromissos);

  // 7. Actual spending per variable category (from qol_expenses + pluggy_transactions)
  const qolByCategory = await db
    .select({
      category: qolExpenses.category,
      total: sql<string>`COALESCE(SUM(${qolExpenses.amount}), 0)`,
    })
    .from(qolExpenses)
    .where(and(eq(qolExpenses.userId, userId), eq(qolExpenses.year, year), eq(qolExpenses.month, month)))
    .groupBy(qolExpenses.category);

  // Also get spending from pluggy_transactions (debit, VARIABLE categories only, in this month)
  // Exclude: fixo (already in manual fixed), receita, investimento, nao_categorizado
  // Also exclude transactions linked to a fixed expense (linkedExpenseType='fixed')
  const variableCategories = ["lazer", "alimentacao", "transporte", "saude", "pessoal", "imprevistos", "outros"];
  const pluggyByCategory = await db
    .select({
      category: pluggyTransactions.category,
      total: sql<string>`COALESCE(SUM(${pluggyTransactions.amount}), 0)`,
    })
    .from(pluggyTransactions)
    .where(
      and(
        eq(pluggyTransactions.userId, userId),
        eq(pluggyTransactions.type, "debit"),
        inArray(pluggyTransactions.category, variableCategories as any),
        isNull(pluggyTransactions.linkedExpenseType),
        gte(pluggyTransactions.transactionDate, startDate),
        lte(pluggyTransactions.transactionDate, endDate)
      )
    )
    .groupBy(pluggyTransactions.category);

  // Get credits (refunds/reimbursements) with variable categories to subtract from spending
  const pluggyCreditsByCategory = await db
    .select({
      category: pluggyTransactions.category,
      total: sql<string>`COALESCE(SUM(${pluggyTransactions.amount}), 0)`,
    })
    .from(pluggyTransactions)
    .where(
      and(
        eq(pluggyTransactions.userId, userId),
        eq(pluggyTransactions.type, "credit"),
        inArray(pluggyTransactions.category, variableCategories as any),
        gte(pluggyTransactions.transactionDate, startDate),
        lte(pluggyTransactions.transactionDate, endDate)
      )
    )
    .groupBy(pluggyTransactions.category);

  // 7b. Planned expenses by category (to count toward category budgets)
  const plannedByCategory = await db
    .select({
      category: plannedExpenses.category,
      total: sql<string>`COALESCE(SUM(${plannedExpenses.amount}), 0)`,
    })
    .from(plannedExpenses)
    .where(and(eq(plannedExpenses.userId, userId), eq(plannedExpenses.year, year), eq(plannedExpenses.month, month)))
    .groupBy(plannedExpenses.category);

  // 7c. Installment expenses by category (to count toward category budgets)
  const installmentByCategory = await db
    .select({
      category: installmentExpenses.category,
      total: sql<string>`COALESCE(SUM(${installmentExpenseMonths.amount}), 0)`,
    })
    .from(installmentExpenseMonths)
    .innerJoin(installmentExpenses, eq(installmentExpenseMonths.installmentExpenseId, installmentExpenses.id))
    .where(and(
      eq(installmentExpenseMonths.userId, userId),
      eq(installmentExpenseMonths.year, year),
      eq(installmentExpenseMonths.month, month),
      eq(installmentExpenses.isActive, true)
    ))
    .groupBy(installmentExpenses.category);

  // Merge spending from all sources, then subtract credits
  const spendingMap = new Map<string, number>();
  for (const row of qolByCategory) {
    spendingMap.set(row.category, (spendingMap.get(row.category) ?? 0) + parseFloat(row.total));
  }
  for (const row of pluggyByCategory) {
    const cat = row.category as string;
    spendingMap.set(cat, (spendingMap.get(cat) ?? 0) + parseFloat(row.total));
  }
  // Add planned expenses to their respective categories
  for (const row of plannedByCategory) {
    const cat = row.category as string;
    spendingMap.set(cat, (spendingMap.get(cat) ?? 0) + parseFloat(row.total));
  }
  // Add installment expenses to their respective categories
  for (const row of installmentByCategory) {
    const cat = row.category as string;
    spendingMap.set(cat, (spendingMap.get(cat) ?? 0) + parseFloat(row.total));
  }
  // Subtract credits (refunds) from their respective categories
  for (const row of pluggyCreditsByCategory) {
    const cat = row.category as string;
    const current = spendingMap.get(cat) ?? 0;
    spendingMap.set(cat, Math.max(0, current - parseFloat(row.total)));
  }

  // Build category budgets and spending
  // Note: percentages are stored as whole numbers (28 = 28%), so divide by 100
  const categories = Object.entries(categoryPercentages).map(([cat, pct]) => {
    const pctValue = (pct as number) > 1 ? (pct as number) / 100 : (pct as number);
    const budget = disponivel * pctValue;
    const spent = spendingMap.get(cat) ?? 0;
    return { category: cat, budget, spent, percentage: pct as number };
  });

  return {
    totalIncome,
    manualIncome,
    manualFixedIncome,
    totalExtraIncome,
    pluggyExtraIncome,
    totalFixed,
    investmentTarget,
    realInvestment,
    effectiveInvestment,
    totalCompromissos,
    totalInstallments,
    totalPlanned,
    disponivel,
    categories,
    categoryPercentages,
  };
  } catch (error) {
    console.error("[getDashboardFunnel] Error:", error);
    // Return safe default so frontend doesn't break
    const defaultPercentages = DEFAULT_CATEGORY_PERCENTAGES;
    return {
      totalIncome: 0,
      manualIncome: 0,
      manualFixedIncome: 0,
      totalExtraIncome: 0,
      pluggyExtraIncome: 0,
      totalFixed: 0,
      investmentTarget: 0,
      realInvestment: 0,
      effectiveInvestment: 0,
      totalCompromissos: 0,
      totalInstallments: 0,
      totalPlanned: 0,
      disponivel: 0,
      categories: Object.entries(defaultPercentages).map(([cat, pct]) => ({
        category: cat, budget: 0, spent: 0, percentage: pct as number,
      })),
      categoryPercentages: defaultPercentages,
    };
  }
}

// ─── Investment History ─────────────────────────────────────────────────────

export async function getInvestmentHistory(userId: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  // If the entire year is before the cutoff, return empty
  if (year < DATA_CUTOFF_YEAR) return [];

  // Get real investment amounts per month from pluggy_transactions (debit + category='investimento')
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);

  const monthlyInvestments = await db
    .select({
      month: sql<number>`MONTH(${pluggyTransactions.transactionDate})`,
      total: sql<string>`COALESCE(SUM(${pluggyTransactions.amount}), 0)`,
    })
    .from(pluggyTransactions)
    .where(
      and(
        eq(pluggyTransactions.userId, userId),
        eq(pluggyTransactions.type, "debit"),
        eq(pluggyTransactions.category, "investimento" as any),
        gte(pluggyTransactions.transactionDate, startDate),
        lte(pluggyTransactions.transactionDate, endDate)
      )
    )
    .groupBy(sql`MONTH(${pluggyTransactions.transactionDate})`);

  // Get investment target from budget_settings for each month
  const budgetRows = await db
    .select({
      month: budgetSettings.month,
      investmentTarget: budgetSettings.investmentTarget,
    })
    .from(budgetSettings)
    .where(
      and(
        eq(budgetSettings.userId, userId),
        eq(budgetSettings.year, year)
      )
    );

  // Build monthly map
  const investmentMap = new Map<number, number>();
  for (const row of monthlyInvestments) {
    investmentMap.set(row.month, parseFloat(row.total));
  }

  const targetMap = new Map<number, number>();
  for (const row of budgetRows) {
    targetMap.set(row.month, parseFloat(row.investmentTarget ?? "0"));
  }

  // Return array of 12 months (filtered by cutoff for the cutoff year)
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    // Skip months before the cutoff in the cutoff year
    if (year === DATA_CUTOFF_YEAR && month < DATA_CUTOFF_MONTH) {
      return { month, realInvestment: 0, target: 0 };
    }
    const realInvestment = investmentMap.get(month) ?? 0;
    const target = targetMap.get(month) ?? 0;
    return { month, realInvestment, target };
  });
}


// ─── Category Transaction Details ─────────────────────────────────────────────

export async function getCategoryTransactions(userId: number, year: number, month: number, category: string) {
  const cat = category as any; // Cast to satisfy Drizzle enum column type
  if (year < DATA_CUTOFF_YEAR || (year === DATA_CUTOFF_YEAR && month < DATA_CUTOFF_MONTH)) return [];
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  type TransactionDetail = { description: string; amount: number; source: string; date: string };
  const results: TransactionDetail[] = [];

  // 1. Pluggy transactions (debit, not linked, matching category)
  const pluggyRows = await db
    .select({
      description: pluggyTransactions.description,
      amount: pluggyTransactions.amount,
      date: pluggyTransactions.transactionDate,
    })
    .from(pluggyTransactions)
    .where(and(
      eq(pluggyTransactions.userId, userId),
      eq(pluggyTransactions.type, "debit"),
      eq(pluggyTransactions.category, cat),
      isNull(pluggyTransactions.linkedExpenseType),
      gte(pluggyTransactions.transactionDate, startDate),
      lte(pluggyTransactions.transactionDate, endDate)
    ))
    .orderBy(pluggyTransactions.transactionDate);

  for (const row of pluggyRows) {
    results.push({
      description: row.description ?? "Transação Pluggy",
      amount: parseFloat(String(row.amount)),
      source: "pluggy",
      date: row.date ? new Date(row.date).toISOString().slice(0, 10) : "",
    });
  }

  // 2. Pluggy credits (refunds) that reduce this category
  const pluggyCreditRows = await db
    .select({
      description: pluggyTransactions.description,
      amount: pluggyTransactions.amount,
      date: pluggyTransactions.transactionDate,
    })
    .from(pluggyTransactions)
    .where(and(
      eq(pluggyTransactions.userId, userId),
      eq(pluggyTransactions.type, "credit"),
      eq(pluggyTransactions.category, cat),
      gte(pluggyTransactions.transactionDate, startDate),
      lte(pluggyTransactions.transactionDate, endDate)
    ))
    .orderBy(pluggyTransactions.transactionDate);

  for (const row of pluggyCreditRows) {
    results.push({
      description: `(Crédito) ${row.description ?? "Reembolso"}`,
      amount: -parseFloat(String(row.amount)),
      source: "pluggy_credit",
      date: row.date ? new Date(row.date).toISOString().slice(0, 10) : "",
    });
  }

  // 3. Manual QoL expenses
  const qolRows = await db
    .select({
      description: qolExpenses.description,
      amount: qolExpenses.amount,
    })
    .from(qolExpenses)
    .where(and(
      eq(qolExpenses.userId, userId),
      eq(qolExpenses.year, year),
      eq(qolExpenses.month, month),
      eq(qolExpenses.category, cat)
    ));

  for (const row of qolRows) {
    results.push({
      description: row.description ?? "Gasto manual",
      amount: parseFloat(String(row.amount)),
      source: "manual",
      date: "",
    });
  }

  // 4. Planned expenses with this category
  const plannedRows = await db
    .select({
      description: plannedExpenses.description,
      amount: plannedExpenses.amount,
    })
    .from(plannedExpenses)
    .where(and(
      eq(plannedExpenses.userId, userId),
      eq(plannedExpenses.year, year),
      eq(plannedExpenses.month, month),
      eq(plannedExpenses.category, cat)
    ));

  for (const row of plannedRows) {
    results.push({
      description: `(Programado) ${row.description ?? "Gasto programado"}`,
      amount: parseFloat(String(row.amount)),
      source: "planned",
      date: "",
    });
  }

  // 5. Installment expenses with this category
  const installmentRows = await db
    .select({
      description: installmentExpenses.description,
      amount: installmentExpenseMonths.amount,
    })
    .from(installmentExpenseMonths)
    .innerJoin(installmentExpenses, eq(installmentExpenseMonths.installmentExpenseId, installmentExpenses.id))
    .where(and(
      eq(installmentExpenseMonths.userId, userId),
      eq(installmentExpenseMonths.year, year),
      eq(installmentExpenseMonths.month, month),
      eq(installmentExpenses.category, cat),
      eq(installmentExpenses.isActive, true)
    ));

  for (const row of installmentRows) {
    results.push({
      description: `(Parcela) ${row.description ?? "Parcela"}`,
      amount: parseFloat(String(row.amount)),
      source: "installment",
      date: "",
    });
  }

  // Sort by date descending (items without date go to end)
  results.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  return results;
}
