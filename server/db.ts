import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
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
  data: { baseMonthlyBudget?: string; investmentRate?: string; annualReturnRate?: string }
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
  return result[0];
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
  return db.insert(fixedExpenseCategories).values({ userId, ...data });
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
    category: "lazer" | "alimentacao" | "transporte" | "saude" | "outros";
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

export async function updateQolExpense(id: number, userId: number, data: Partial<{ description: string; amount: string; category: "lazer" | "alimentacao" | "transporte" | "saude" | "outros"; paymentType: "credit_card" | "cash"; creditCardId: number; transactionDate: Date }>) {
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
    category: "lazer" | "alimentacao" | "transporte" | "saude" | "outros";
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
    category: "lazer" | "alimentacao" | "transporte" | "saude" | "outros";
    creditCardId?: number;
    transactionDate: Date;
  }
) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(plannedExpenses).values({ userId, ...data });
  return result[0];
}

export async function updatePlannedExpense(id: number, userId: number, data: Partial<{ description: string; amount: string; isPaid: boolean; category: "lazer" | "alimentacao" | "transporte" | "saude" | "outros"; paymentType: "credit_card" | "cash"; creditCardId: number }>) {
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
    type: "debit" | "credit";
    transactionDate: Date;
    category?: "lazer" | "alimentacao" | "transporte" | "saude" | "outros" | "receita" | "fixo" | "investimento" | "nao_categorizado";
  }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(pluggyTransactions)
    .values({ userId, ...data })
    .onDuplicateKeyUpdate({ set: { description: data.description, amount: data.amount, category: data.category ?? "nao_categorizado" } });
}

export async function updatePluggyTransactionCategory(
  id: number,
  userId: number,
  category: "lazer" | "alimentacao" | "transporte" | "saude" | "outros" | "receita" | "fixo" | "investimento" | "nao_categorizado"
) {
  const db = await getDb();
  if (!db) return;
  await db.update(pluggyTransactions).set({ category, isReviewed: true }).where(and(eq(pluggyTransactions.id, id), eq(pluggyTransactions.userId, userId)));
}

// ─── Dashboard Aggregation ────────────────────────────────────────────────────

export async function getDashboardSummary(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return null;

  // Total income
  const incomeResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${incomeEntries.amount}), 0)` })
    .from(incomeEntries)
    .where(and(eq(incomeEntries.userId, userId), eq(incomeEntries.year, year), eq(incomeEntries.month, month)));

  // Total fixed expenses
  const fixedResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${fixedExpenseEntries.amount}), 0)` })
    .from(fixedExpenseEntries)
    .where(and(eq(fixedExpenseEntries.userId, userId), eq(fixedExpenseEntries.year, year), eq(fixedExpenseEntries.month, month)));

  // Total QoL expenses
  const qolResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${qolExpenses.amount}), 0)` })
    .from(qolExpenses)
    .where(and(eq(qolExpenses.userId, userId), eq(qolExpenses.year, year), eq(qolExpenses.month, month)));

  // QoL by category
  const qolByCategory = await db
    .select({
      category: qolExpenses.category,
      total: sql<string>`COALESCE(SUM(${qolExpenses.amount}), 0)`,
    })
    .from(qolExpenses)
    .where(and(eq(qolExpenses.userId, userId), eq(qolExpenses.year, year), eq(qolExpenses.month, month)))
    .groupBy(qolExpenses.category);

  // Total installments this month
  const installmentResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${installmentExpenseMonths.amount}), 0)` })
    .from(installmentExpenseMonths)
    .where(and(eq(installmentExpenseMonths.userId, userId), eq(installmentExpenseMonths.year, year), eq(installmentExpenseMonths.month, month)));

  // Total planned expenses
  const plannedResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${plannedExpenses.amount}), 0)` })
    .from(plannedExpenses)
    .where(and(eq(plannedExpenses.userId, userId), eq(plannedExpenses.year, year), eq(plannedExpenses.month, month)));

  // Budget settings
  const budget = await getBudgetSettings(userId, year, month);

  const totalIncome = parseFloat(incomeResult[0]?.total ?? "0");
  const totalFixed = parseFloat(fixedResult[0]?.total ?? "0");
  const totalQol = parseFloat(qolResult[0]?.total ?? "0");
  const totalInstallments = parseFloat(installmentResult[0]?.total ?? "0");
  const totalPlanned = parseFloat(plannedResult[0]?.total ?? "0");
  const totalExpenses = totalFixed + totalQol + totalInstallments + totalPlanned;
  const balance = totalIncome - totalExpenses;

  const investmentRate = parseFloat(budget?.investmentRate ?? "0.15");
  const annualReturnRate = parseFloat(budget?.annualReturnRate ?? "0.15");
  const fcp = totalIncome * investmentRate * annualReturnRate;

  return {
    totalIncome,
    totalFixed,
    totalQol,
    totalInstallments,
    totalPlanned,
    totalExpenses,
    balance,
    fcp,
    baseMonthlyBudget: parseFloat(budget?.baseMonthlyBudget ?? "0"),
    investmentRate,
    annualReturnRate,
    qolByCategory: qolByCategory.map((r) => ({ category: r.category, total: parseFloat(r.total) })),
  };
}

// ─── Annual History ───────────────────────────────────────────────────────────

export async function getAnnualQolHistory(userId: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      month: qolExpenses.month,
      category: qolExpenses.category,
      total: sql<string>`COALESCE(SUM(${qolExpenses.amount}), 0)`,
    })
    .from(qolExpenses)
    .where(and(eq(qolExpenses.userId, userId), eq(qolExpenses.year, year)))
    .groupBy(qolExpenses.month, qolExpenses.category);
}
