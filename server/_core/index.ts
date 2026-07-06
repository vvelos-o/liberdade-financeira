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
