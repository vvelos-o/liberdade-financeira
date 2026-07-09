import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-finance",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return { ctx };
}

function createUnauthContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return { ctx };
}

describe("Finance Master - Backend Procedures", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  describe("income router", () => {
    it("getSources returns an array", async () => {
      const result = await caller.income.getSources();
      expect(Array.isArray(result)).toBe(true);
    });

    it("createSource creates a new income source", async () => {
      const result = await caller.income.createSource({ name: "Salário CLT", type: "fixed" });
      // MySQL insert returns ResultSetHeader, not the inserted row
      // Verify by fetching sources after creation
      const sources = await caller.income.getSources();
      const found = sources.find((s: any) => s.name === "Salário CLT");
      expect(found).toBeDefined();
      expect(found?.type).toBe("fixed");
    });

    it("getEntries returns entries for a given month", async () => {
      const result = await caller.income.getEntries({ year: 2026, month: 7 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("fixedExpenses router", () => {
    it("getCategories returns an array", async () => {
      const result = await caller.fixedExpenses.getCategories();
      expect(Array.isArray(result)).toBe(true);
    });

    it("createCategory creates a new fixed expense", async () => {
      await caller.fixedExpenses.createCategory({ name: "Aluguel" });
      const categories = await caller.fixedExpenses.getCategories();
      const found = categories.find((c: any) => c.name === "Aluguel");
      expect(found).toBeDefined();
    });
  });

  describe("budget router", () => {
    it("get returns budget settings (or null for new user)", async () => {
      const result = await caller.budget.get({ year: 2026, month: 7 });
      // Can be null if no budget set yet, or an object
      expect(result === null || result === undefined || typeof result === "object").toBe(true);
    });

    it("upsert creates/updates budget settings", async () => {
      await caller.budget.upsert({
        year: 2026,
        month: 7,
        investmentTarget: "1000",
        categoryPercentages: {
          lazer: 28,
          alimentacao: 28,
          saude: 18,
          transporte: 8,
          pessoal: 10,
          imprevistos: 8,
        },
      });
      // Verify by reading back
      const result = await caller.budget.get({ year: 2026, month: 7 });
      expect(result).toBeDefined();
      if (result) {
        // DB stores as decimal string e.g. "1000.00"
        expect(parseFloat(result.investmentTarget ?? "0")).toBe(1000);
        expect(result.categoryPercentages).toBeDefined();
      }
    });
  });

  describe("goals router", () => {
    let goalId: number | undefined;

    it("getAll returns an array", async () => {
      const result = await caller.goals.getAll();
      expect(Array.isArray(result)).toBe(true);
    });

    it("create creates a new goal", async () => {
      // goals.create input uses targetDate not deadline, and no goalType in schema
      await caller.goals.create({
        title: "Viagem Europa",
        targetAmount: "5000",
        targetDate: new Date("2026-12-31"),
      });
      const all = await caller.goals.getAll();
      const found = all.find((g: any) => g.title === "Viagem Europa");
      expect(found).toBeDefined();
      if (found) goalId = found.id;
    });

    it("delete removes the goal", async () => {
      if (goalId) {
        await caller.goals.delete({ id: goalId });
        const all = await caller.goals.getAll();
        const found = all.find((g: any) => g.id === goalId);
        expect(found).toBeUndefined();
      }
    });
  });

  describe("dashboard router", () => {
    it("getFunnel returns structured data", async () => {
      const result = await caller.dashboard.getFunnel({ year: 2026, month: 7 });
      expect(result).toBeDefined();
      expect(result).toHaveProperty("totalIncome");
      expect(result).toHaveProperty("totalFixed");
      expect(result).toHaveProperty("investmentTarget");
      expect(result).toHaveProperty("totalCompromissos");
      expect(result).toHaveProperty("disponivel");
      expect(result).toHaveProperty("categories");
      expect(Array.isArray(result.categories)).toBe(true);
    });

    it("getFunnel categories include all 6 variable categories", async () => {
      const result = await caller.dashboard.getFunnel({ year: 2026, month: 7 });
      const categoryNames = result.categories.map((c: any) => c.category);
      expect(categoryNames).toContain("lazer");
      expect(categoryNames).toContain("alimentacao");
      expect(categoryNames).toContain("saude");
      expect(categoryNames).toContain("transporte");
      expect(categoryNames).toContain("pessoal");
      expect(categoryNames).toContain("imprevistos");
    });
  });

  describe("insights router", () => {
    it("get returns null or an insight object", async () => {
      const result = await caller.insights.get({ year: 2026, month: 7 });
      expect(result === null || result === undefined || typeof result === "object").toBe(true);
    });
  });

  describe("annual router", () => {
    it("getQolHistory returns an array", async () => {
      const result = await caller.annual.getQolHistory({ year: 2026 });
      expect(Array.isArray(result)).toBe(true);
    });

    it("getIncomeHistory returns an array", async () => {
      const result = await caller.annual.getIncomeHistory({ year: 2026 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("pluggy router", () => {
    it("getConnections returns an array", async () => {
      const result = await caller.pluggy.getConnections();
      expect(Array.isArray(result)).toBe(true);
    });

    it("getTransactions returns an array", async () => {
      const result = await caller.pluggy.getTransactions({ year: 2026, month: 7 });
      expect(Array.isArray(result)).toBe(true);
    });

    it("correctCategory updates category", async () => {
      // First insert a test transaction directly via db
      const db = await import("./db");
      await db.upsertPluggyTransaction(1, {
        pluggyTransactionId: "test-correct-cat-" + Date.now(),
        pluggyItemId: "test-item",
        description: "UBER TRIP DOWNTOWN",
        amount: "25.00",
        type: "debit",
        transactionDate: new Date(2026, 6, 5), // July 5, 2026
        category: "nao_categorizado",
      });
      // Get the transaction
      const txs = await caller.pluggy.getTransactions({ year: 2026, month: 7 });
      const testTx = txs.find((t: any) => t.description === "UBER TRIP DOWNTOWN");
      expect(testTx).toBeDefined();
      expect(testTx.category).toBe("nao_categorizado");

      // Now correct the category
      const result = await caller.pluggy.correctCategory({
        transactionId: testTx.id,
        category: "transporte",
        description: "UBER TRIP DOWNTOWN",
      });
      expect(result.success).toBe(true);

      // Verify the transaction was updated
      const txsAfter = await caller.pluggy.getTransactions({ year: 2026, month: 7 });
      const updatedTx = txsAfter.find((t: any) => t.id === testTx.id);
      expect(updatedTx.category).toBe("transporte");
      expect(updatedTx.isReviewed).toBe(true);
    });
  });

  describe("auth protection", () => {
    it("unauthenticated user cannot access protected procedures", async () => {
      const { ctx: unauthCtx } = createUnauthContext();
      const unauthCaller = appRouter.createCaller(unauthCtx);
      await expect(unauthCaller.income.getSources()).rejects.toThrow();
    });
  });
});
