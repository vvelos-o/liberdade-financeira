import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { z } from "zod";
import { pluggyRouter } from "./routers/pluggy";

// ─── Shared Schemas ───────────────────────────────────────────────────────────

const yearMonthSchema = z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(1).max(12) });
const categorySchema = z.enum(["lazer", "alimentacao", "transporte", "saude", "outros", "pessoal", "imprevistos"]);
const paymentTypeSchema = z.enum(["credit_card", "cash"]);

// ─── Budget Router ────────────────────────────────────────────────────────────

const budgetRouter = router({
  get: protectedProcedure.input(yearMonthSchema).query(({ ctx, input }) =>
    db.getBudgetSettings(ctx.user.id, input.year, input.month)
  ),
  upsert: protectedProcedure
    .input(yearMonthSchema.extend({
      baseMonthlyBudget: z.string().optional(),
      investmentRate: z.string().optional(),
      annualReturnRate: z.string().optional(),
      investmentTarget: z.string().optional(),
      categoryPercentages: z.record(z.string(), z.number()).optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { year, month, ...data } = input;
      return db.upsertBudgetSettings(ctx.user.id, year, month, data);
    }),
});

// ─── Income Router ────────────────────────────────────────────────────────────

const incomeRouter = router({
  getSources: protectedProcedure.query(({ ctx }) => db.getIncomeSources(ctx.user.id)),
  createSource: protectedProcedure
    .input(z.object({ name: z.string().min(1), type: z.enum(["fixed", "variable", "extra"]), sortOrder: z.number().optional() }))
    .mutation(({ ctx, input }) => db.createIncomeSource(ctx.user.id, input)),
  updateSource: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), type: z.enum(["fixed", "variable", "extra"]).optional(), sortOrder: z.number().optional(), isActive: z.boolean().optional() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updateIncomeSource(id, ctx.user.id, data);
    }),
  deleteSource: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) =>
    db.deleteIncomeSource(input.id, ctx.user.id)
  ),
  getEntries: protectedProcedure.input(yearMonthSchema).query(({ ctx, input }) =>
    db.getIncomeEntries(ctx.user.id, input.year, input.month)
  ),
  getEntriesForYear: protectedProcedure.input(z.object({ year: z.number() })).query(({ ctx, input }) =>
    db.getIncomeEntriesForYear(ctx.user.id, input.year)
  ),
  upsertEntry: protectedProcedure
    .input(yearMonthSchema.extend({ sourceId: z.number(), amount: z.string(), notes: z.string().optional() }))
    .mutation(({ ctx, input }) =>
      db.upsertIncomeEntry(ctx.user.id, input.sourceId, input.year, input.month, input.amount, input.notes)
    ),
  handleExtra: protectedProcedure
    .input(z.object({
      amount: z.string(),
      action: z.enum(["invest", "budget"]),
      year: z.number(),
      month: z.number(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // If user chooses to invest, we just log it (investment tracking is informational)
      // If user chooses to add to budget, we create an extra income entry for next month
      if (input.action === "budget") {
        // Find or create an "Extra" income source
        const sources = await db.getIncomeSources(ctx.user.id);
        let extraSource = sources?.find((s: any) => s.type === "extra" && s.name === "Sobra do mês");
        if (!extraSource) {
          await db.createIncomeSource(ctx.user.id, { name: "Sobra do mês", type: "extra" });
          const updatedSources = await db.getIncomeSources(ctx.user.id);
          extraSource = updatedSources?.find((s: any) => s.type === "extra" && s.name === "Sobra do mês");
        }
        if (extraSource) {
          const nextMonth = input.month === 12 ? 1 : input.month + 1;
          const nextYear = input.month === 12 ? input.year + 1 : input.year;
          await db.upsertIncomeEntry(ctx.user.id, extraSource.id, nextYear, nextMonth, input.amount, input.description || "Sobra do mês anterior");
        }
      }
      return { success: true, action: input.action };
    }),
});

// ─── Fixed Expenses Router ────────────────────────────────────────────────────

const fixedExpensesRouter = router({
  getCategories: protectedProcedure.query(({ ctx }) => db.getFixedExpenseCategories(ctx.user.id)),
  createCategory: protectedProcedure
    .input(z.object({ name: z.string().min(1), sortOrder: z.number().optional() }))
    .mutation(({ ctx, input }) => db.createFixedExpenseCategory(ctx.user.id, input)),
  updateCategory: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), sortOrder: z.number().optional(), isActive: z.boolean().optional() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updateFixedExpenseCategory(id, ctx.user.id, data);
    }),
  getEntries: protectedProcedure.input(yearMonthSchema).query(({ ctx, input }) =>
    db.getFixedExpenseEntries(ctx.user.id, input.year, input.month)
  ),
  getEntriesForYear: protectedProcedure.input(z.object({ year: z.number() })).query(({ ctx, input }) =>
    db.getFixedExpenseEntriesForYear(ctx.user.id, input.year)
  ),
  upsertEntry: protectedProcedure
    .input(yearMonthSchema.extend({ categoryId: z.number(), amount: z.string(), notes: z.string().optional() }))
    .mutation(({ ctx, input }) =>
      db.upsertFixedExpenseEntry(ctx.user.id, input.categoryId, input.year, input.month, input.amount, input.notes)
    ),
});

// ─── QoL Expenses Router ──────────────────────────────────────────────────────

const qolRouter = router({
  getExpenses: protectedProcedure.input(yearMonthSchema).query(({ ctx, input }) =>
    db.getQolExpenses(ctx.user.id, input.year, input.month)
  ),
  getExpensesForYear: protectedProcedure.input(z.object({ year: z.number() })).query(({ ctx, input }) =>
    db.getQolExpensesForYear(ctx.user.id, input.year)
  ),
  create: protectedProcedure
    .input(z.object({
      year: z.number(),
      month: z.number(),
      category: categorySchema,
      paymentType: paymentTypeSchema,
      description: z.string().min(1),
      amount: z.string(),
      creditCardId: z.number().optional(),
      transactionDate: z.date(),
      pluggyTransactionId: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => db.createQolExpense(ctx.user.id, input)),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      description: z.string().optional(),
      amount: z.string().optional(),
      category: categorySchema.optional(),
      paymentType: paymentTypeSchema.optional(),
      creditCardId: z.number().optional(),
      transactionDate: z.date().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updateQolExpense(id, ctx.user.id, data);
    }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) =>
    db.deleteQolExpense(input.id, ctx.user.id)
  ),
});

// ─── Installment Expenses Router ──────────────────────────────────────────────

const installmentRouter = router({
  getAll: protectedProcedure.query(({ ctx }) => db.getInstallmentExpenses(ctx.user.id)),
  getMonthsForPeriod: protectedProcedure.input(yearMonthSchema).query(({ ctx, input }) =>
    db.getInstallmentMonthsForPeriod(ctx.user.id, input.year, input.month)
  ),
  getMonthsForYear: protectedProcedure.input(z.object({ year: z.number() })).query(({ ctx, input }) =>
    db.getInstallmentMonthsForYear(ctx.user.id, input.year)
  ),
  create: protectedProcedure
    .input(z.object({
      description: z.string().min(1),
      totalAmount: z.string(),
      installmentAmount: z.string(),
      totalInstallments: z.number().int().min(1).max(120),
      startYear: z.number(),
      startMonth: z.number().min(1).max(12),
      creditCardId: z.number().optional(),
      category: categorySchema,
    }))
    .mutation(({ ctx, input }) => db.createInstallmentExpense(ctx.user.id, input)),
  markPaid: protectedProcedure
    .input(z.object({ id: z.number(), isPaid: z.boolean() }))
    .mutation(({ ctx, input }) => db.markInstallmentMonthPaid(input.id, ctx.user.id, input.isPaid)),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) =>
    db.deleteInstallmentExpense(input.id, ctx.user.id)
  ),
});

// ─── Planned Expenses Router ──────────────────────────────────────────────────

const plannedRouter = router({
  getExpenses: protectedProcedure.input(yearMonthSchema).query(({ ctx, input }) =>
    db.getPlannedExpenses(ctx.user.id, input.year, input.month)
  ),
  getExpensesForYear: protectedProcedure.input(z.object({ year: z.number() })).query(({ ctx, input }) =>
    db.getPlannedExpensesForYear(ctx.user.id, input.year)
  ),
  create: protectedProcedure
    .input(z.object({
      description: z.string().min(1),
      amount: z.string(),
      year: z.number(),
      month: z.number(),
      paymentType: paymentTypeSchema,
      category: categorySchema,
      creditCardId: z.number().optional(),
      transactionDate: z.date(),
    }))
    .mutation(({ ctx, input }) => db.createPlannedExpense(ctx.user.id, input)),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      description: z.string().optional(),
      amount: z.string().optional(),
      isPaid: z.boolean().optional(),
      category: categorySchema.optional(),
      paymentType: paymentTypeSchema.optional(),
      creditCardId: z.number().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updatePlannedExpense(id, ctx.user.id, data);
    }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) =>
    db.deletePlannedExpense(input.id, ctx.user.id)
  ),
});

// ─── Credit Cards Router ──────────────────────────────────────────────────────

const creditCardsRouter = router({
  getCards: protectedProcedure.query(({ ctx }) => db.getCreditCards(ctx.user.id)),
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), lastFourDigits: z.string().length(4).optional(), color: z.string().optional() }))
    .mutation(({ ctx, input }) => db.createCreditCard(ctx.user.id, input)),
  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), lastFourDigits: z.string().optional(), color: z.string().optional(), isActive: z.boolean().optional() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updateCreditCard(id, ctx.user.id, data);
    }),
  getMonthly: protectedProcedure.input(yearMonthSchema).query(({ ctx, input }) =>
    db.getCreditCardMonthly(ctx.user.id, input.year, input.month)
  ),
  markPaid: protectedProcedure
    .input(z.object({ creditCardId: z.number(), year: z.number(), month: z.number(), isPaid: z.boolean() }))
    .mutation(({ ctx, input }) =>
      db.markCreditCardPaid(input.creditCardId, ctx.user.id, input.year, input.month, input.isPaid)
    ),
});

// ─── Financial Goals Router ───────────────────────────────────────────────────

const goalsRouter = router({
  getAll: protectedProcedure.query(({ ctx }) => db.getFinancialGoals(ctx.user.id)),
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      targetAmount: z.string(),
      currentAmount: z.string().optional(),
      targetDate: z.date().optional(),
      period: z.string().optional(),
      notes: z.string().optional(),
      goalType: z.enum(["commitment", "optional"]).optional(),
    }))
    .mutation(({ ctx, input }) => {
      let suggestedMonthlyAmount: string | undefined;
      if (input.goalType === "optional" && input.targetDate) {
        const now = new Date();
        const monthsLeft = Math.max(1, (input.targetDate.getFullYear() - now.getFullYear()) * 12 + (input.targetDate.getMonth() - now.getMonth()));
        const remaining = parseFloat(input.targetAmount) - parseFloat(input.currentAmount ?? "0");
        suggestedMonthlyAmount = (remaining / monthsLeft).toFixed(2);
      }
      return db.createFinancialGoal(ctx.user.id, { ...input, suggestedMonthlyAmount });
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      targetAmount: z.string().optional(),
      currentAmount: z.string().optional(),
      targetDate: z.date().optional(),
      achievedDate: z.date().optional(),
      period: z.string().optional(),
      isAchieved: z.boolean().optional(),
      notes: z.string().optional(),
      goalType: z.enum(["commitment", "optional"]).optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updateFinancialGoal(id, ctx.user.id, data);
    }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) =>
    db.deleteFinancialGoal(input.id, ctx.user.id)
  ),
});

// ─── Dashboard Router ─────────────────────────────────────────────────────────

const dashboardRouter = router({
  getSummary: protectedProcedure.input(yearMonthSchema).query(({ ctx, input }) =>
    db.getDashboardSummary(ctx.user.id, input.year, input.month)
  ),
  getRecentTransactions: protectedProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(({ ctx, input }) => db.getRecentPluggyTransactions(ctx.user.id, input.limit ?? 10)),
  getFunnel: protectedProcedure.input(yearMonthSchema).query(async ({ ctx, input }) => {
    try {
      const result = await db.getDashboardFunnel(ctx.user.id, input.year, input.month);
      return result;
    } catch (error: any) {
      console.error("[getFunnel] CRITICAL ERROR:", error?.message, error?.stack);
      throw error;
    }
  }),
  getCategoryTransactions: protectedProcedure
    .input(yearMonthSchema.extend({ category: z.string() }))
    .query(({ ctx, input }) =>
      db.getCategoryTransactions(ctx.user.id, input.year, input.month, input.category)
    ),
  // Diagnostic endpoint to test individual queries
  debugFunnel: protectedProcedure.input(yearMonthSchema).query(async ({ ctx, input }) => {
    const results: Record<string, any> = {};
    try {
      results.budget = await db.getBudgetSettings(ctx.user.id, input.year, input.month);
      results.budgetKeys = results.budget ? Object.keys(results.budget) : null;
      results.categoryPercentages = results.budget?.categoryPercentages;
      results.categoryPercentagesType = typeof results.budget?.categoryPercentages;
      results.categoryPercentagesEmpty = results.budget?.categoryPercentages ? Object.keys(results.budget.categoryPercentages).length === 0 : 'null';
    } catch (e: any) { results.budgetError = e.message; }
    try {
      results.funnel = await db.getDashboardFunnel(ctx.user.id, input.year, input.month);
    } catch (e: any) { results.funnelError = e.message; results.funnelStack = e.stack?.split('\n').slice(0, 5); }
    return results;
  }),
});

// ─── Insights Router ─────────────────────────────────────────────────────────

const insightsRouter = router({
  get: protectedProcedure.input(yearMonthSchema).query(({ ctx, input }) =>
    db.getMonthlyInsight(ctx.user.id, input.year, input.month)
  ),
  generate: protectedProcedure.input(yearMonthSchema).mutation(({ ctx, input }) =>
    db.generateMonthlyInsight(ctx.user.id, input.year, input.month)
  ),
  dismiss: protectedProcedure.input(yearMonthSchema).mutation(({ ctx, input }) =>
    db.dismissMonthlyInsight(ctx.user.id, input.year, input.month)
  ),
});

// ─── Annual History Router ────────────────────────────────────────────────────

const annualRouter = router({
  getQolHistory: protectedProcedure.input(z.object({ year: z.number() })).query(({ ctx, input }) =>
    db.getAnnualQolHistory(ctx.user.id, input.year)
  ),
  getIncomeHistory: protectedProcedure.input(z.object({ year: z.number() })).query(({ ctx, input }) =>
    db.getIncomeEntriesForYear(ctx.user.id, input.year)
  ),
  getFixedHistory: protectedProcedure.input(z.object({ year: z.number() })).query(({ ctx, input }) =>
    db.getFixedExpenseEntriesForYear(ctx.user.id, input.year)
  ),
  getInstallmentHistory: protectedProcedure.input(z.object({ year: z.number() })).query(({ ctx, input }) =>
    db.getInstallmentMonthsForYear(ctx.user.id, input.year)
  ),
  getPlannedHistory: protectedProcedure.input(z.object({ year: z.number() })).query(({ ctx, input }) =>
    db.getPlannedExpensesForYear(ctx.user.id, input.year)
  ),
  getInvestmentHistory: protectedProcedure.input(z.object({ year: z.number() })).query(({ ctx, input }) =>
    db.getInvestmentHistory(ctx.user.id, input.year)
  ),
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  budget: budgetRouter,
  income: incomeRouter,
  fixedExpenses: fixedExpensesRouter,
  qol: qolRouter,
  installments: installmentRouter,
  planned: plannedRouter,
  creditCards: creditCardsRouter,
  goals: goalsRouter,
  dashboard: dashboardRouter,
  annual: annualRouter,
  pluggy: pluggyRouter,
  insights: insightsRouter,
});

export type AppRouter = typeof appRouter;
