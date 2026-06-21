import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ─── Core Auth ────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Budget Settings ──────────────────────────────────────────────────────────

export const budgetSettings = mysqlTable("budget_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(), // 1-12
  baseMonthlyBudget: decimal("baseMonthlyBudget", { precision: 12, scale: 2 }).default("0.00").notNull(),
  investmentRate: decimal("investmentRate", { precision: 5, scale: 4 }).default("0.1500").notNull(), // % poupada para investir
  annualReturnRate: decimal("annualReturnRate", { precision: 5, scale: 4 }).default("0.1500").notNull(), // índice retorno anual
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userYearMonthIdx: uniqueIndex("budget_settings_user_year_month").on(t.userId, t.year, t.month),
}));

// ─── Income ───────────────────────────────────────────────────────────────────

export const incomeSources = mysqlTable("income_sources", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["fixed", "variable", "extra"]).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx: index("income_sources_user_idx").on(t.userId),
}));

export const incomeEntries = mysqlTable("income_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sourceId: int("sourceId").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(), // 1-12
  amount: decimal("amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userYearMonthIdx: index("income_entries_user_year_month").on(t.userId, t.year, t.month),
  sourceYearMonthIdx: uniqueIndex("income_entries_source_year_month").on(t.sourceId, t.year, t.month),
}));

// ─── Fixed Expenses ───────────────────────────────────────────────────────────

export const fixedExpenseCategories = mysqlTable("fixed_expense_categories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx: index("fixed_expense_categories_user_idx").on(t.userId),
}));

export const fixedExpenseEntries = mysqlTable("fixed_expense_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  categoryId: int("categoryId").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userYearMonthIdx: index("fixed_expense_entries_user_year_month").on(t.userId, t.year, t.month),
  categoryYearMonthIdx: uniqueIndex("fixed_expense_entries_cat_year_month").on(t.categoryId, t.year, t.month),
}));

// ─── Quality of Life Expenses ─────────────────────────────────────────────────

export const qolExpenses = mysqlTable("qol_expenses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(),
  category: mysqlEnum("category", ["lazer", "alimentacao", "transporte", "saude", "outros"]).notNull(),
  paymentType: mysqlEnum("paymentType", ["credit_card", "cash"]).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  creditCardId: int("creditCardId"), // null if cash
  transactionDate: timestamp("transactionDate").notNull(),
  pluggyTransactionId: varchar("pluggyTransactionId", { length: 128 }), // linked Pluggy tx
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userYearMonthIdx: index("qol_expenses_user_year_month").on(t.userId, t.year, t.month),
  userCategoryIdx: index("qol_expenses_user_category").on(t.userId, t.category),
}));

// ─── Installment Expenses (Gastos a Prazo) ────────────────────────────────────

export const installmentExpenses = mysqlTable("installment_expenses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
  installmentAmount: decimal("installmentAmount", { precision: 12, scale: 2 }).notNull(),
  totalInstallments: int("totalInstallments").notNull(),
  paidInstallments: int("paidInstallments").default(0).notNull(),
  startYear: int("startYear").notNull(),
  startMonth: int("startMonth").notNull(),
  creditCardId: int("creditCardId"),
  category: mysqlEnum("category", ["lazer", "alimentacao", "transporte", "saude", "outros"]).default("outros").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx: index("installment_expenses_user_idx").on(t.userId),
}));

export const installmentExpenseMonths = mysqlTable("installment_expense_months", {
  id: int("id").autoincrement().primaryKey(),
  installmentExpenseId: int("installmentExpenseId").notNull(),
  userId: int("userId").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(),
  installmentNumber: int("installmentNumber").notNull(), // 1-based
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  isPaid: boolean("isPaid").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  expenseYearMonthIdx: index("installment_months_expense_year_month").on(t.installmentExpenseId, t.year, t.month),
  userYearMonthIdx: index("installment_months_user_year_month").on(t.userId, t.year, t.month),
}));

// ─── Planned Expenses (Gastos Pontuais Programados) ───────────────────────────

export const plannedExpenses = mysqlTable("planned_expenses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(),
  paymentType: mysqlEnum("paymentType", ["credit_card", "cash"]).notNull(),
  category: mysqlEnum("category", ["lazer", "alimentacao", "transporte", "saude", "outros"]).default("outros").notNull(),
  creditCardId: int("creditCardId"),
  transactionDate: timestamp("transactionDate").notNull(),
  isPaid: boolean("isPaid").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userYearMonthIdx: index("planned_expenses_user_year_month").on(t.userId, t.year, t.month),
}));

// ─── Credit Cards ─────────────────────────────────────────────────────────────

export const creditCards = mysqlTable("credit_cards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  lastFourDigits: varchar("lastFourDigits", { length: 4 }),
  color: varchar("color", { length: 7 }).default("#6366f1").notNull(), // hex color
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx: index("credit_cards_user_idx").on(t.userId),
}));

export const creditCardMonthly = mysqlTable("credit_card_monthly", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  creditCardId: int("creditCardId").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  isPaid: boolean("isPaid").default(false).notNull(),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  cardYearMonthIdx: uniqueIndex("credit_card_monthly_card_year_month").on(t.creditCardId, t.year, t.month),
}));

// ─── Financial Goals ──────────────────────────────────────────────────────────

export const financialGoals = mysqlTable("financial_goals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  targetAmount: decimal("targetAmount", { precision: 12, scale: 2 }).notNull(),
  currentAmount: decimal("currentAmount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  targetDate: timestamp("targetDate"),
  achievedDate: timestamp("achievedDate"),
  period: varchar("period", { length: 64 }), // e.g. "2025-2026"
  isAchieved: boolean("isAchieved").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx: index("financial_goals_user_idx").on(t.userId),
}));

// ─── Pluggy Integration ───────────────────────────────────────────────────────

export const pluggyConnections = mysqlTable("pluggy_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  pluggyItemId: varchar("pluggyItemId", { length: 128 }).notNull().unique(),
  connectorName: varchar("connectorName", { length: 255 }),
  connectorId: int("connectorId"),
  status: mysqlEnum("status", ["updated", "updating", "waiting_user_input", "login_error", "outdated", "error"]).default("updated").notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx: index("pluggy_connections_user_idx").on(t.userId),
}));

export const pluggyTransactions = mysqlTable("pluggy_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  pluggyTransactionId: varchar("pluggyTransactionId", { length: 128 }).notNull().unique(),
  pluggyItemId: varchar("pluggyItemId", { length: 128 }).notNull(),
  accountId: varchar("accountId", { length: 128 }),
  description: varchar("description", { length: 500 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  type: mysqlEnum("type", ["debit", "credit"]).notNull(),
  transactionDate: timestamp("transactionDate").notNull(),
  category: mysqlEnum("category", ["lazer", "alimentacao", "transporte", "saude", "outros", "receita", "fixo", "investimento", "nao_categorizado"]).default("nao_categorizado").notNull(),
  isReviewed: boolean("isReviewed").default(false).notNull(),
  linkedExpenseId: int("linkedExpenseId"), // linked to qol_expenses or planned_expenses
  linkedExpenseType: mysqlEnum("linkedExpenseType", ["qol", "planned", "installment", "fixed"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx: index("pluggy_transactions_user_idx").on(t.userId),
  userDateIdx: index("pluggy_transactions_user_date").on(t.userId, t.transactionDate),
}));

// ─── Type Exports ─────────────────────────────────────────────────────────────

export type BudgetSettings = typeof budgetSettings.$inferSelect;
export type IncomeSource = typeof incomeSources.$inferSelect;
export type IncomeEntry = typeof incomeEntries.$inferSelect;
export type FixedExpenseCategory = typeof fixedExpenseCategories.$inferSelect;
export type FixedExpenseEntry = typeof fixedExpenseEntries.$inferSelect;
export type QolExpense = typeof qolExpenses.$inferSelect;
export type InstallmentExpense = typeof installmentExpenses.$inferSelect;
export type InstallmentExpenseMonth = typeof installmentExpenseMonths.$inferSelect;
export type PlannedExpense = typeof plannedExpenses.$inferSelect;
export type CreditCard = typeof creditCards.$inferSelect;
export type CreditCardMonthly = typeof creditCardMonthly.$inferSelect;
export type FinancialGoal = typeof financialGoals.$inferSelect;
export type PluggyConnection = typeof pluggyConnections.$inferSelect;
export type PluggyTransaction = typeof pluggyTransactions.$inferSelect;
