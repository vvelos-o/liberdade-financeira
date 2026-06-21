import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import axios from "axios";

// ─── Pluggy API Helper ────────────────────────────────────────────────────────

const PLUGGY_API_URL = "https://api.pluggy.ai";

async function getPluggyApiKey(clientId: string, clientSecret: string): Promise<string> {
  const response = await axios.post(`${PLUGGY_API_URL}/auth`, {
    clientId,
    clientSecret,
  });
  return response.data.apiKey;
}

async function createPluggyConnectToken(apiKey: string, itemId?: string): Promise<string> {
  const body: Record<string, unknown> = {};
  if (itemId) body.itemId = itemId;
  const response = await axios.post(`${PLUGGY_API_URL}/connect_token`, body, {
    headers: { "X-API-KEY": apiKey },
  });
  return response.data.accessToken;
}

async function getPluggyItem(apiKey: string, itemId: string) {
  const response = await axios.get(`${PLUGGY_API_URL}/items/${itemId}`, {
    headers: { "X-API-KEY": apiKey },
  });
  return response.data;
}

async function getPluggyAccounts(apiKey: string, itemId: string) {
  const response = await axios.get(`${PLUGGY_API_URL}/accounts?itemId=${itemId}`, {
    headers: { "X-API-KEY": apiKey },
  });
  return response.data.results ?? [];
}

async function getPluggyTransactions(apiKey: string, accountId: string, from?: string, to?: string) {
  let url = `${PLUGGY_API_URL}/transactions?accountId=${accountId}&pageSize=500`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;
  const response = await axios.get(url, {
    headers: { "X-API-KEY": apiKey },
  });
  return response.data.results ?? [];
}

// ─── Auto-categorization ──────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  lazer: ["netflix", "spotify", "cinema", "teatro", "show", "ingresso", "steam", "game", "entretenimento", "bar", "restaurante", "pizza", "hamburguer", "ifood", "uber eats", "rappi"],
  alimentacao: ["supermercado", "mercado", "padaria", "açougue", "hortifruti", "atacado", "carrefour", "extra", "pão de açúcar", "atacadão", "assaí"],
  transporte: ["uber", "99", "taxi", "combustivel", "gasolina", "etanol", "posto", "estacionamento", "pedágio", "metro", "onibus", "bilhete único", "recarga"],
  saude: ["farmácia", "drogaria", "médico", "hospital", "clínica", "dentista", "plano de saúde", "exame", "laboratorio", "remédio"],
  fixo: ["aluguel", "condomínio", "energia", "água", "internet", "telefone", "celular", "seguro"],
  investimento: ["investimento", "tesouro", "fundo", "ação", "cdb", "lci", "lca", "poupança", "xp", "btg", "rico", "clear"],
  receita: ["salário", "salario", "pagamento", "pix recebido", "transferência recebida"],
};

function autoCategorize(description: string): "lazer" | "alimentacao" | "transporte" | "saude" | "outros" | "receita" | "fixo" | "investimento" | "nao_categorizado" {
  const lower = description.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category as ReturnType<typeof autoCategorize>;
    }
  }
  return "nao_categorizado";
}

// ─── Pluggy Router ────────────────────────────────────────────────────────────

export const pluggyRouter = router({
  // Get all connections for the user
  getConnections: protectedProcedure.query(({ ctx }) =>
    db.getPluggyConnections(ctx.user.id)
  ),

  // Create a connect token for the Pluggy Widget
  createConnectToken: protectedProcedure
    .input(z.object({ itemId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const clientId = process.env.PLUGGY_CLIENT_ID;
      const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new Error("Pluggy credentials not configured. Please add PLUGGY_CLIENT_ID and PLUGGY_CLIENT_SECRET.");
      }
      const apiKey = await getPluggyApiKey(clientId, clientSecret);
      const connectToken = await createPluggyConnectToken(apiKey, input.itemId);
      return { connectToken };
    }),

  // Register a new item after user connects via widget
  registerItem: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const clientId = process.env.PLUGGY_CLIENT_ID;
      const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
      if (!clientId || !clientSecret) throw new Error("Pluggy credentials not configured.");

      const apiKey = await getPluggyApiKey(clientId, clientSecret);
      const item = await getPluggyItem(apiKey, input.itemId);

      await db.upsertPluggyConnection(ctx.user.id, {
        pluggyItemId: input.itemId,
        connectorName: item.connector?.name ?? "Banco",
        connectorId: item.connector?.id,
        status: item.status ?? "updated",
        lastSyncAt: new Date(),
      });

      return { success: true, connectorName: item.connector?.name };
    }),

  // Sync transactions for all connections
  syncTransactions: protectedProcedure
    .input(z.object({ itemId: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const clientId = process.env.PLUGGY_CLIENT_ID;
      const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
      if (!clientId || !clientSecret) throw new Error("Pluggy credentials not configured.");

      const apiKey = await getPluggyApiKey(clientId, clientSecret);
      const connections = await db.getPluggyConnections(ctx.user.id);
      const targetConnections = input.itemId ? connections.filter((c) => c.pluggyItemId === input.itemId) : connections;

      let totalImported = 0;
      for (const conn of targetConnections) {
        try {
          const accounts = await getPluggyAccounts(apiKey, conn.pluggyItemId);
          for (const account of accounts) {
            const transactions = await getPluggyTransactions(apiKey, account.id, input.fromDate, input.toDate);
            for (const tx of transactions) {
              const category = autoCategorize(tx.description ?? "");
              await db.upsertPluggyTransaction(ctx.user.id, {
                pluggyTransactionId: tx.id,
                pluggyItemId: conn.pluggyItemId,
                accountId: account.id,
                description: tx.description ?? "",
                amount: String(Math.abs(tx.amount ?? 0)),
                type: (tx.amount ?? 0) < 0 ? "debit" : "credit",
                transactionDate: new Date(tx.date),
                category,
              });
              totalImported++;
            }
          }
          await db.upsertPluggyConnection(ctx.user.id, {
            pluggyItemId: conn.pluggyItemId,
            status: "updated",
            lastSyncAt: new Date(),
          });
        } catch (err) {
          console.error(`[Pluggy] Sync error for item ${conn.pluggyItemId}:`, err);
        }
      }
      return { success: true, totalImported };
    }),

  // Get transactions for a given month
  getTransactions: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(({ ctx, input }) => db.getPluggyTransactions(ctx.user.id, input.year, input.month)),

  // Update category of a transaction
  updateCategory: protectedProcedure
    .input(z.object({
      id: z.number(),
      category: z.enum(["lazer", "alimentacao", "transporte", "saude", "outros", "receita", "fixo", "investimento", "nao_categorizado"]),
    }))
    .mutation(({ ctx, input }) =>
      db.updatePluggyTransactionCategory(input.id, ctx.user.id, input.category)
    ),

  // Delete a connection
  deleteConnection: protectedProcedure
    .input(z.object({ pluggyItemId: z.string() }))
    .mutation(({ ctx, input }) =>
      db.deletePluggyConnection(input.pluggyItemId, ctx.user.id)
    ),

  // Check if credentials are configured
  getStatus: protectedProcedure.query(() => ({
    configured: !!(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET),
  })),
});

// ─── Webhook Handler (Express route, not tRPC) ────────────────────────────────
// Registered in server/_core/index.ts as POST /api/webhooks/pluggy

export async function handlePluggyWebhook(body: {
  event: string;
  itemId?: string;
  data?: Record<string, unknown>;
}) {
  console.log("[Pluggy Webhook] Event:", body.event, "ItemId:", body.itemId);

  if (body.event === "item/updated" && body.itemId) {
    // Find the user who owns this item and trigger a sync
    const { getDb } = await import("../db");
    const { pluggyConnections } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const dbConn = await getDb();
    if (!dbConn) return;

    const connections = await dbConn
      .select()
      .from(pluggyConnections)
      .where(eq(pluggyConnections.pluggyItemId, body.itemId))
      .limit(1);

    if (connections.length > 0) {
      const conn = connections[0];
      await db.upsertPluggyConnection(conn.userId, {
        pluggyItemId: body.itemId,
        status: "updated",
        lastSyncAt: new Date(),
      });
    }
  }
}
