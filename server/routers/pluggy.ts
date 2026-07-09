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

interface PluggyTransaction {
  id: string;
  description?: string;
  descriptionRaw?: string;
  amount?: number;
  date?: string;
  type?: string; // "DEBIT" or "CREDIT" from Pluggy API
  status?: string; // "PENDING" or "POSTED"
  creditCardMetadata?: {
    installmentNumber?: number;
    totalInstallments?: number;
    totalAmount?: number;
  };
}

async function getPluggyTransactions(apiKey: string, accountId: string, from?: string, to?: string) {
  // v2 uses cursor-based pagination (pageSize param is not supported)
  const allResults: PluggyTransaction[] = [];
  let cursor: string | undefined = undefined;
  let page = 0;
  const MAX_PAGES = 20; // safety limit

  do {
    let url = `${PLUGGY_API_URL}/v2/transactions?accountId=${accountId}`;
    if (from) url += `&from=${from}`;
    if (to) url += `&to=${to}`;
    if (cursor) url += `&cursor=${cursor}`;

    const response = await axios.get(url, {
      headers: { "X-API-KEY": apiKey },
    });

    const results = response.data.results ?? [];
    allResults.push(...results);
    cursor = response.data.nextCursor ?? undefined;
    page++;
  } while (cursor && page < MAX_PAGES);

  return allResults;
}

// Patterns that indicate a transfer (not a real income or expense)
const TRANSFER_PATTERNS = [
  "pagamento de fatura",
  "pgto fatura",
  "pag fatura",
  "pagamento fatura",
  "pagamento recebido",
  "transferencia entre contas",
  "transferência entre contas",
  "aplicacao",
  "aplicação",
  "resgate",
];

function isTransferTransaction(description: string): boolean {
  const lower = description.toLowerCase();
  return TRANSFER_PATTERNS.some(pattern => lower.includes(pattern));
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
              const desc = tx.description ?? "";
              const amount = Math.abs(tx.amount ?? 0);

              // Determine transaction type using Pluggy's type field (DEBIT/CREDIT)
              // tx.type from Pluggy API: "DEBIT" = outflow, "CREDIT" = inflow
              let txType: "debit" | "credit" | "transfer";
              if (isTransferTransaction(desc)) {
                txType = "transfer";
              } else if (tx.type?.toUpperCase() === "DEBIT") {
                txType = "debit";
              } else if (tx.type?.toUpperCase() === "CREDIT") {
                txType = "credit";
              } else {
                // Fallback: infer from amount sign (for bank accounts: negative = outflow)
                txType = (tx.amount ?? 0) < 0 ? "debit" : "credit";
              }

              // No auto-categorization: user categorizes manually
              let category: string = "nao_categorizado";

              await db.upsertPluggyTransaction(ctx.user.id, {
                pluggyTransactionId: tx.id,
                pluggyItemId: conn.pluggyItemId,
                accountId: account.id,
                description: desc,
                amount: String(amount),
                type: txType,
                transactionDate: new Date(tx.date ?? Date.now()),
                category: category as any,
              });

              // NOTE: Auto-installment creation from Pluggy was removed because:
              // 1. It created duplicates on every re-sync (no unique constraint)
              // 2. It double-counted: same amount in both compromissos AND variable spending
              // Installments should be managed manually via the Gastos a Prazo page.
              // Pluggy transactions with installment patterns (X/Y) are tracked as regular
              // debit transactions in their respective variable spending categories.
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
      category: z.enum(["lazer", "alimentacao", "transporte", "saude", "pessoal", "imprevistos", "outros", "receita", "receita_contabilizada", "fixo", "investimento", "nao_categorizado"]),
      linkedExpenseId: z.number().nullable().optional(),
      linkedExpenseType: z.enum(["qol", "planned", "installment", "fixed"]).nullable().optional(),
    }))
    .mutation(({ ctx, input }) =>
      db.updatePluggyTransactionCategory(input.id, ctx.user.id, input.category, input.linkedExpenseId, input.linkedExpenseType)
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
