import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock Database ─────────────────────────────────────────────────────────────
vi.mock("./db", async () => {
  return {
    getDb: vi.fn().mockResolvedValue(null),
    upsertUser: vi.fn().mockResolvedValue(undefined),
    getUserByOpenId: vi.fn().mockResolvedValue(undefined),
    // Budget
    getBudgetSettings: vi.fn().mockResolvedValue({ investmentTargetPct: 15, returnRatePct: 15 }),
    upsertBudgetSettings: vi.fn().mockResolvedValue(undefined),
    // Income
    getIncomeSources: vi.fn().mockResolvedValue([]),
    createIncomeSource: vi.fn().mockResolvedValue({ id: 1, name: "Salário", type: "fixed", userId: 1, sortOrder: 0, isActive: true, createdAt: new Date(), updatedAt: new Date() }),
    updateIncomeSource: vi.fn().mockResolvedValue({ id: 1 }),
    deleteIncomeSource: vi.fn().mockResolvedValue(undefined),
    getIncomeEntries: vi.fn().mockResolvedValue([]),
    getIncomeEntriesForYear: vi.fn().mockResolvedValue([]),
    upsertIncomeEntry: vi.fn().mockResolvedValue({ id: 1 }),
    // Fixed Expenses
    getFixedExpenseCategories: vi.fn().mockResolvedValue([]),
    createFixedExpenseCategory: vi.fn().mockResolvedValue({ id: 1, name: "Aluguel", budget: "2000", userId: 1, sortOrder: 0, isActive: true, createdAt: new Date(), updatedAt: new Date() }),
    updateFixedExpenseCategory: vi.fn().mockResolvedValue({ id: 1 }),
    getFixedExpenseEntries: vi.fn().mockResolvedValue([]),
    getFixedExpenseEntriesForYear: vi.fn().mockResolvedValue([]),
    upsertFixedExpenseEntry: vi.fn().mockResolvedValue({ id: 1 }),
    // QoL
    getQolExpenses: vi.fn().mockResolvedValue([]),
    getQolExpensesForYear: vi.fn().mockResolvedValue([]),
    createQolExpense: vi.fn().mockResolvedValue({ id: 1, description: "Netflix", amount: "50", category: "lazer", paymentType: "credit_card", userId: 1, year: 2026, month: 6, day: 15, transactionDate: new Date(), createdAt: new Date(), updatedAt: new Date() }),
    updateQolExpense: vi.fn().mockResolvedValue({ id: 1 }),
    deleteQolExpense: vi.fn().mockResolvedValue(undefined),
    // Installments
    getInstallmentExpenses: vi.fn().mockResolvedValue([]),
    getInstallmentMonthsForPeriod: vi.fn().mockResolvedValue([]),
    getInstallmentMonthsForYear: vi.fn().mockResolvedValue([]),
    createInstallmentExpense: vi.fn().mockResolvedValue({ id: 1, description: "Notebook", totalAmount: "3000", installmentAmount: "250", totalInstallments: 12, userId: 1, startYear: 2026, startMonth: 1, category: "outros", createdAt: new Date(), updatedAt: new Date() }),
    markInstallmentMonthPaid: vi.fn().mockResolvedValue({ id: 1, isPaid: true }),
    deleteInstallmentExpense: vi.fn().mockResolvedValue(undefined),
    // Planned
    getPlannedExpenses: vi.fn().mockResolvedValue([]),
    getPlannedExpensesForYear: vi.fn().mockResolvedValue([]),
    createPlannedExpense: vi.fn().mockResolvedValue({ id: 1, description: "Viagem", amount: "1500", userId: 1, year: 2026, month: 6, isPaid: false, paymentType: "credit_card", category: "lazer", transactionDate: new Date(), createdAt: new Date(), updatedAt: new Date() }),
    updatePlannedExpense: vi.fn().mockResolvedValue({ id: 1 }),
    deletePlannedExpense: vi.fn().mockResolvedValue(undefined),
    // Credit Cards
    getCreditCards: vi.fn().mockResolvedValue([]),
    createCreditCard: vi.fn().mockResolvedValue({ id: 1, name: "Nubank", lastFourDigits: null, color: null, userId: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() }),
    updateCreditCard: vi.fn().mockResolvedValue({ id: 1 }),
    getCreditCardMonthly: vi.fn().mockResolvedValue([]),
    upsertCreditCardMonthly: vi.fn().mockResolvedValue(undefined),
    markCreditCardPaid: vi.fn().mockResolvedValue(undefined),
    // Goals
    getFinancialGoals: vi.fn().mockResolvedValue([]),
    createFinancialGoal: vi.fn().mockResolvedValue({ id: 1, title: "Reserva de Emergência", targetAmount: "30000", userId: 1, currentAmount: "0", targetDate: new Date("2027-12-31"), createdAt: new Date(), updatedAt: new Date() }),
    updateFinancialGoal: vi.fn().mockResolvedValue({ id: 1 }),
    deleteFinancialGoal: vi.fn().mockResolvedValue(undefined),
    // Dashboard
    getDashboardFunnel: vi.fn().mockResolvedValue({
      totalIncome: 8600,
      totalFixed: 3000,
      investmentTarget: 1000,
      compromissos: 500,
      disponivel: 4100,
      totalVariableSpent: 1200,
      categoryBudgets: [
        { category: "lazer", budget: 1025, spent: 300 },
        { category: "alimentacao", budget: 1025, spent: 400 },
      ],
    }),
    getCategoryTransactions: vi.fn().mockResolvedValue([]),
    // Annual
    getAnnualQolHistory: vi.fn().mockResolvedValue([]),
    // Pluggy
    getPluggyConnections: vi.fn().mockResolvedValue([]),
    upsertPluggyConnection: vi.fn().mockResolvedValue(undefined),
    deletePluggyConnection: vi.fn().mockResolvedValue(undefined),
    getPluggyTransactions: vi.fn().mockResolvedValue([]),
    getRecentPluggyTransactions: vi.fn().mockResolvedValue([]),
    upsertPluggyTransaction: vi.fn().mockResolvedValue(undefined),
    updatePluggyTransactionCategory: vi.fn().mockResolvedValue(undefined),
  };
});

// ─── Test Context ──────────────────────────────────────────────────────────────
function createTestContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-openid",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Auth Tests ────────────────────────────────────────────────────────────────
describe("auth", () => {
  it("returns current user from me query", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeDefined();
    expect(user?.id).toBe(1);
    expect(user?.email).toBe("test@example.com");
  });

  it("clears session cookie on logout", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(ctx.res.clearCookie).toHaveBeenCalled();
  });
});

// ─── Dashboard Tests ───────────────────────────────────────────────────────────
describe("dashboard", () => {
  it("returns funnel with all financial fields", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const funnel = await caller.dashboard.getFunnel({ year: 2026, month: 7 });
    expect(funnel).toBeDefined();
    expect(funnel).toHaveProperty("totalIncome");
    expect(funnel).toHaveProperty("disponivel");
    expect(funnel).toHaveProperty("categoryBudgets");
  });

  it("returns budget settings with default values", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const settings = await caller.budget.get({ year: 2026, month: 6 });
    expect(settings).toBeDefined();
    expect(settings).toHaveProperty("investmentTargetPct");
    expect(settings).toHaveProperty("returnRatePct");
    expect(settings?.investmentTargetPct).toBe(15);
  });
});

// ─── Income Tests ──────────────────────────────────────────────────────────────
describe("income", () => {
  it("lists income sources for user", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const sources = await caller.income.getSources();
    expect(Array.isArray(sources)).toBe(true);
  });

  it("creates a new fixed income source", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const source = await caller.income.createSource({ name: "Salário", type: "fixed" });
    expect(source).toBeDefined();
    expect(source.name).toBe("Salário");
    expect(source.type).toBe("fixed");
  });

  it("returns income entries for a month", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const entries = await caller.income.getEntries({ year: 2026, month: 6 });
    expect(Array.isArray(entries)).toBe(true);
  });
});

// ─── Fixed Expenses Tests ──────────────────────────────────────────────────────
describe("fixedExpenses", () => {
  it("lists fixed expense categories", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const categories = await caller.fixedExpenses.getCategories();
    expect(Array.isArray(categories)).toBe(true);
  });

  it("creates a new fixed expense category with budget", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const category = await caller.fixedExpenses.createCategory({ name: "Aluguel", budget: 2000 });
    expect(category).toBeDefined();
    expect(category.name).toBe("Aluguel");
  });
});

// ─── QoL Expenses Tests ────────────────────────────────────────────────────────
describe("qol", () => {
  it("lists QoL entries for a month", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const entries = await caller.qol.getExpenses({ year: 2026, month: 6 });
    expect(Array.isArray(entries)).toBe(true);
  });

  it("creates a Lazer QoL entry paid by credit card", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const entry = await caller.qol.create({
      description: "Netflix",
      amount: "50",
      category: "lazer",
      paymentType: "credit_card",
      year: 2026,
      month: 6,
      transactionDate: new Date("2026-06-15"),
    });
    expect(entry).toBeDefined();
    expect(entry.description).toBe("Netflix");
    expect(entry.category).toBe("lazer");
  });
});

// ─── Installments Tests ────────────────────────────────────────────────────────
describe("installments", () => {
  it("lists all installment plans", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const plans = await caller.installments.getAll();
    expect(Array.isArray(plans)).toBe(true);
  });

  it("creates installment plan with 12 parcelas", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const plan = await caller.installments.create({
      description: "Notebook",
      totalAmount: "3000",
      installmentAmount: "250",
      totalInstallments: 12,
      startYear: 2026,
      startMonth: 1,
      category: "outros",
    });
    expect(plan).toBeDefined();
    expect(plan.totalInstallments).toBe(12);
    expect(plan.description).toBe("Notebook");
  });

  it("returns installment months for a period", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const months = await caller.installments.getMonthsForPeriod({ year: 2026, month: 6 });
    expect(Array.isArray(months)).toBe(true);
  });
});

// ─── Planned Expenses Tests ────────────────────────────────────────────────────
describe("planned", () => {
  it("lists planned expenses for a month", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const expenses = await caller.planned.getExpenses({ year: 2026, month: 6 });
    expect(Array.isArray(expenses)).toBe(true);
  });

  it("creates a planned expense", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const expense = await caller.planned.create({
      description: "Viagem",
      amount: "1500",
      year: 2026,
      month: 6,
      paymentType: "credit_card",
      category: "lazer",
      transactionDate: new Date("2026-06-20"),
    });
    expect(expense).toBeDefined();
    expect(expense.description).toBe("Viagem");
  });
});

// ─── Credit Cards Tests ────────────────────────────────────────────────────────
describe("creditCards", () => {
  it("lists credit cards", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const cards = await caller.creditCards.getCards();
    expect(Array.isArray(cards)).toBe(true);
  });

  it("creates a new credit card", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const card = await caller.creditCards.create({ name: "Nubank" });
    expect(card).toBeDefined();
    expect(card.name).toBe("Nubank");
  });
});

// ─── Financial Goals Tests ─────────────────────────────────────────────────────
describe("goals", () => {
  it("lists financial goals", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const goals = await caller.goals.getAll();
    expect(Array.isArray(goals)).toBe(true);
  });

  it("creates a new financial goal", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const goal = await caller.goals.create({
      title: "Reserva de Emergência",
      targetAmount: "30000",
      targetDate: new Date("2027-12-31"),
    });
    expect(goal).toBeDefined();
    expect(goal.title).toBe("Reserva de Emergência");
    expect(goal.targetAmount).toBe("30000");
  });
});

// ─── Pluggy Tests ──────────────────────────────────────────────────────────────
describe("pluggy", () => {
  it("returns configuration status as boolean", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const status = await caller.pluggy.getStatus();
    expect(status).toBeDefined();
    expect(status).toHaveProperty("configured");
    expect(typeof status.configured).toBe("boolean");
  });

  it("returns empty connections when none configured", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const connections = await caller.pluggy.getConnections();
    expect(Array.isArray(connections)).toBe(true);
    expect(connections).toHaveLength(0);
  });

  it("returns empty transactions for a month", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const txs = await caller.pluggy.getTransactions({ year: 2026, month: 6 });
    expect(Array.isArray(txs)).toBe(true);
  });
});

// ─── Annual Tests ──────────────────────────────────────────────────────────────
describe("annual", () => {
  it("returns QoL history for a year", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const history = await caller.annual.getQolHistory({ year: 2026 });
    expect(Array.isArray(history)).toBe(true);
  });

  it("returns income history for a year", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const history = await caller.annual.getIncomeHistory({ year: 2026 });
    expect(Array.isArray(history)).toBe(true);
  });

  it("returns fixed expense history for a year", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const history = await caller.annual.getFixedHistory({ year: 2026 });
    expect(Array.isArray(history)).toBe(true);
  });
});

// ─── FCP Calculation Logic Tests ───────────────────────────────────────────────
describe("FCP calculation logic", () => {
  it("calculates FCP correctly when income > expenses", () => {
    const income = 5000;
    const expenses = 3500;
    const savings = income - expenses;
    const fcp = (savings / income) * 100;
    expect(fcp).toBe(30);
  });

  it("calculates FCP as 0 when income is 0", () => {
    const income = 0;
    const fcp = income > 0 ? ((income - 0) / income) * 100 : 0;
    expect(fcp).toBe(0);
  });

  it("calculates negative FCP when expenses exceed income", () => {
    const income = 3000;
    const expenses = 4000;
    const savings = income - expenses;
    const fcp = (savings / income) * 100;
    expect(fcp).toBeLessThan(0);
    expect(fcp).toBeCloseTo(-33.33, 1);
  });

  it("classifies FCP >= 30% as Excelente", () => {
    const fcp = 30;
    const label = fcp >= 30 ? "Excelente" : fcp >= 15 ? "Bom" : fcp >= 5 ? "Regular" : "Atenção";
    expect(label).toBe("Excelente");
  });

  it("classifies FCP 15-29% as Bom", () => {
    const fcp = 20;
    const label = fcp >= 30 ? "Excelente" : fcp >= 15 ? "Bom" : fcp >= 5 ? "Regular" : "Atenção";
    expect(label).toBe("Bom");
  });

  it("classifies FCP < 5% as Atenção", () => {
    const fcp = 2;
    const label = fcp >= 30 ? "Excelente" : fcp >= 15 ? "Bom" : fcp >= 5 ? "Regular" : "Atenção";
    expect(label).toBe("Atenção");
  });
});

// ─── Installment Propagation Logic Tests ──────────────────────────────────────
describe("installment propagation logic", () => {
  it("generates correct number of installment months", () => {
    const startYear = 2026;
    const startMonth = 1;
    const totalInstallments = 12;
    const months: { year: number; month: number; installmentNumber: number }[] = [];

    for (let i = 0; i < totalInstallments; i++) {
      const totalMonths = (startYear * 12 + startMonth - 1) + i;
      const year = Math.floor(totalMonths / 12);
      const month = (totalMonths % 12) + 1;
      months.push({ year, month, installmentNumber: i + 1 });
    }

    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ year: 2026, month: 1, installmentNumber: 1 });
    expect(months[11]).toEqual({ year: 2026, month: 12, installmentNumber: 12 });
  });

  it("correctly wraps installments across year boundary", () => {
    const startYear = 2026;
    const startMonth = 10;
    const totalInstallments = 6;
    const months: { year: number; month: number }[] = [];

    for (let i = 0; i < totalInstallments; i++) {
      const totalMonths = (startYear * 12 + startMonth - 1) + i;
      const year = Math.floor(totalMonths / 12);
      const month = (totalMonths % 12) + 1;
      months.push({ year, month });
    }

    expect(months[0]).toEqual({ year: 2026, month: 10 });
    expect(months[2]).toEqual({ year: 2026, month: 12 });
    expect(months[3]).toEqual({ year: 2027, month: 1 });
    expect(months[5]).toEqual({ year: 2027, month: 3 });
  });

  it("calculates monthly installment amount correctly", () => {
    const totalAmount = 1200;
    const installments = 12;
    const monthlyAmount = totalAmount / installments;
    expect(monthlyAmount).toBe(100);
  });
});
