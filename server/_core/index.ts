import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handlePluggyWebhook } from "../routers/pluggy";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // Pluggy Webhook
  app.post("/api/webhooks/pluggy", async (req, res) => {
    try {
      await handlePluggyWebhook(req.body);
      res.json({ received: true });
    } catch (err) {
      console.error("[Pluggy Webhook] Error:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Migration endpoint to apply missing schema changes on Railway
  app.get("/api/migrate", async (req, res) => {
    const pin = req.query.pin;
    if (pin !== process.env.APP_PIN) return res.status(403).json({ error: "Invalid PIN" });
    const results: string[] = [];
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "No DB connection" });
      const { sql } = await import("drizzle-orm");
      
      // Check and add missing columns to budget_settings
      const migrations = [
        { check: "investmentTarget", sql: "ALTER TABLE `budget_settings` ADD COLUMN `investmentTarget` decimal(12,2) DEFAULT '0.00'" },
        { check: "categoryPercentages", sql: "ALTER TABLE `budget_settings` ADD COLUMN `categoryPercentages` json" },
        { check: "goalType on financial_goals", sql: "ALTER TABLE `financial_goals` ADD COLUMN `goalType` enum('commitment','optional') DEFAULT 'optional' NOT NULL" },
      ];
      
      for (const m of migrations) {
        try {
          await db.execute(sql.raw(m.sql));
          results.push(`✅ Applied: ${m.check}`);
        } catch (e: any) {
          if (e.message?.includes("Duplicate column")) {
            results.push(`⏭️ Already exists: ${m.check}`);
          } else {
            results.push(`❌ Failed ${m.check}: ${e.message}`);
          }
        }
      }
      
      // Update enums to include pessoal/imprevistos
      const enumMigrations = [
        { table: "category_rules", sql: "ALTER TABLE `category_rules` MODIFY COLUMN `category` enum('lazer','alimentacao','transporte','saude','outros','pessoal','imprevistos','receita','receita_contabilizada','fixo','investimento','nao_categorizado') NOT NULL" },
        { table: "installment_expenses", sql: "ALTER TABLE `installment_expenses` MODIFY COLUMN `category` enum('lazer','alimentacao','transporte','saude','outros','pessoal','imprevistos') NOT NULL DEFAULT 'outros'" },
        { table: "planned_expenses", sql: "ALTER TABLE `planned_expenses` MODIFY COLUMN `category` enum('lazer','alimentacao','transporte','saude','outros','pessoal','imprevistos') NOT NULL DEFAULT 'outros'" },
        { table: "pluggy_transactions", sql: "ALTER TABLE `pluggy_transactions` MODIFY COLUMN `category` enum('lazer','alimentacao','transporte','saude','outros','pessoal','imprevistos','receita','receita_contabilizada','fixo','investimento','nao_categorizado') NOT NULL DEFAULT 'nao_categorizado'" },
        { table: "qol_expenses", sql: "ALTER TABLE `qol_expenses` MODIFY COLUMN `category` enum('lazer','alimentacao','transporte','saude','outros','pessoal','imprevistos') NOT NULL" },
        { table: "pluggy_transactions_type", sql: "ALTER TABLE `pluggy_transactions` MODIFY COLUMN `type` enum('debit','credit','transfer') NOT NULL" },
      ];
      
      for (const m of enumMigrations) {
        try {
          await db.execute(sql.raw(m.sql));
          results.push(`✅ Enum updated: ${m.table}`);
        } catch (e: any) {
          results.push(`❌ Enum failed ${m.table}: ${e.message}`);
        }
      }
      
      // Clean up auto-created installment duplicates from Pluggy sync
      // These were created without dedup checks and cause inflated compromissos values
      // Safe: auto-installment creation has been removed, so any existing ones are from old syncs
      try {
        // Only clean up if there are duplicates (same description appears multiple times)
        const [dupeCheck] = await db.execute(sql.raw(
          "SELECT description, COUNT(*) as cnt FROM `installment_expenses` GROUP BY description HAVING cnt > 1 LIMIT 1"
        ));
        const hasDupes = Array.isArray(dupeCheck) && dupeCheck.length > 0;
        if (hasDupes) {
          await db.execute(sql.raw("DELETE FROM `installment_expense_months`"));
          await db.execute(sql.raw("DELETE FROM `installment_expenses`"));
          results.push(`✅ Cleaned up duplicate installments (re-add manually if needed)`);
        } else {
          results.push(`⏭️ No duplicate installments found, skipping cleanup`);
        }
      } catch (e: any) {
        results.push(`❌ Installment cleanup failed: ${e.message}`);
      }

      res.json({ success: true, results });
    } catch (e: any) {
      res.status(500).json({ error: e.message, results });
    }
  });

  // Debug endpoint for diagnosing dashboard issues
  app.get("/api/debug/funnel", async (req, res) => {
    const pin = req.query.pin;
    if (pin !== process.env.APP_PIN) return res.status(403).json({ error: "Invalid PIN" });
    const userId = parseInt(req.query.userId as string || "1");
    const year = parseInt(req.query.year as string || "2026");
    const month = parseInt(req.query.month as string || "7");
    const results: Record<string, any> = { userId, year, month };
    try {
      const { getBudgetSettings, getDashboardFunnel } = await import("../db");
      results.budget = await getBudgetSettings(userId, year, month);
      results.categoryPercentagesKeys = results.budget?.categoryPercentages ? Object.keys(results.budget.categoryPercentages) : 'null/undefined';
    } catch (e: any) { results.budgetError = e.message; }
    try {
      const { getDashboardFunnel } = await import("../db");
      results.funnel = await getDashboardFunnel(userId, year, month);
    } catch (e: any) { results.funnelError = e.message; results.funnelStack = e.stack?.split('\n').slice(0, 8); }
    res.json(results);
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
