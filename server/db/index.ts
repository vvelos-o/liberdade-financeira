// Barrel file: re-exports all domain modules so existing `import * as db from "../db"` still works
export { getDb, DATA_CUTOFF_DATE, DATA_CUTOFF_YEAR, DATA_CUTOFF_MONTH } from "./connection";
export { upsertUser, getUserByOpenId } from "./auth";
export { getBudgetSettings, upsertBudgetSettings } from "./budget";
export { getIncomeSources, createIncomeSource, updateIncomeSource, deleteIncomeSource, getIncomeEntries, getIncomeEntriesForYear, upsertIncomeEntry, deleteIncomeEntry } from "./income";
export { getFixedExpenseCategories, createFixedExpenseCategory, updateFixedExpenseCategory, getFixedExpenseEntries, getFixedExpenseEntriesForYear, upsertFixedExpenseEntry } from "./fixedExpenses";
export { getQolExpenses, getQolExpensesForYear, createQolExpense, updateQolExpense, deleteQolExpense } from "./qolExpenses";
export { getInstallmentExpenses, getInstallmentMonthsForPeriod, getInstallmentMonthsForYear, createInstallmentExpense, markInstallmentMonthPaid, deleteInstallmentExpense } from "./installments";
export { getPlannedExpenses, getPlannedExpensesForYear, createPlannedExpense, updatePlannedExpense, deletePlannedExpense } from "./plannedExpenses";
export { getCreditCards, createCreditCard, updateCreditCard, getCreditCardMonthly, upsertCreditCardMonthly, markCreditCardPaid } from "./creditCards";
export { getFinancialGoals, createFinancialGoal, updateFinancialGoal, deleteFinancialGoal } from "./goals";
export { getPluggyConnections, upsertPluggyConnection, deletePluggyConnection, getPluggyTransactions, getRecentPluggyTransactions, upsertPluggyTransaction, updatePluggyTransactionCategory, flipPluggyTransactionType } from "./pluggy";
export { getAnnualQolHistory, getMonthlyInsight, generateMonthlyInsight, dismissMonthlyInsight, getDashboardFunnel, getInvestmentHistory, getCategoryTransactions } from "./dashboard";
