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

async function createPluggyConnectToken(apiKey: string, userId: number, itemId?: string): Promise<string> {
  const body: Record<string, unknown> = {
    clientUserId: String(userId),
    webhookUrl: process.env.APP_URL ? `${process.env.APP_URL}/api/webhooks/pluggy` : undefined
  };
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
  // Pluggy v2 uses cursor pagination and returns the next page in the "next" field
  const allResults: PluggyTransaction[] = [];
  let url: string | undefined =
    `${PLUGGY_API_URL}/v2/transactions?accountId=${accountId}` +
    (from ? `&from=${from}` : "") +
    (to ? `&to=${to}` : "");
  let page = 0;
  const MAX_PAGES = 20; // safety limit

  while (url && page < MAX_PAGES) {
    const response = await axios.get(url, {
      headers: { "X-API-KEY": apiKey },
    });
    allResults.push(...(response.data.results ?? []));
    const next = response.data.next ?? response.data.nextCursor;
    url = next ? `${PLUGGY_API_URL}/v2/transactions${String(next).startsWith("?") ? next : `?cursor=${next}`}` : undefined;
    page++;
  }

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
      const connectToken = await createPluggyConnectToken(apiKey, ctx.user.id, input.itemId);
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
      const errors: string[] = [];
      const debug: Array<Record<string, unknown>> = [];

      if (targetConnections.length === 0) {
        return { success: false, totalImported: 0, errors: ["Nenhuma conexao bancaria encontrada para este usuario."], debug };
      }

      for (const conn of targetConnections) {
        try {
          const item = await getPluggyItem(apiKey, conn.pluggyItemId);
          const accounts = await getPluggyAccounts(apiKey, conn.pluggyItemId);
          debug.push({
            itemId: conn.pluggyItemId,
            itemStatus: item?.status,
            executionStatus: item?.executionStatus,
            accounts: accounts.length,
            accountIds: accounts.map((a: any) => a.id),
          });

          if (accounts.length === 0) {
            errors.push(`Item ${conn.pluggyItemId}: nenhuma conta retornada pela Pluggy (status=${item?.status}, execucao=${item?.executionStatus}).`);
            continue;
          }
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
        } catch (err: any) {
          const status = err?.response?.status;
          const detail = err?.response?.data ? JSON.stringify(err.response.data) : err?.message;
          console.error(`[Pluggy] Sync error for item ${conn.pluggyItemId}:`, status, detail);

          // Item nao existe mais na Pluggy (foi deletado ou pertence a outra aplicacao):
          // removemos a conexao obsoleta do banco para o usuario poder reconectar.
          if (status === 404) {
            try {
              await db.deletePluggyConnection(conn.pluggyItemId, ctx.user.id);
              errors.push(
                `A conexao bancaria antiga era invalida e foi removida automaticamente. Va em Configuracao > Conexao Bancaria e clique em "Conectar conta bancaria" novamente.`
              );
              continue;
            } catch (delErr) {
              console.error("[Pluggy] Falha ao remover conexao obsoleta:", delErr);
            }
          }

          errors.push(`Item ${conn.pluggyItemId}: HTTP ${status ?? "?"} - ${detail}`);
        }
      }
      console.log("[Pluggy] Sync debug:", JSON.stringify(debug), "errors:", JSON.stringify(errors));
      return { success: errors.length === 0, totalImported, errors, debug };
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

  // Flip transaction type (debit↔credit)
  flipType: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) =>
      db.flipPluggyTransactionType(input.id, ctx.user.id)
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
  clientUserId?: string;
  data?: Record<string, unknown>;
}) {
  console.log("[Pluggy Webhook] Event:", body.event, "ItemId:", body.itemId, "ClientUserId:", body.clientUserId);

  if ((body.event === "item/updated" || body.event === "item/created") && body.itemId) {
    // Find the user who owns this item and trigger a sync
    const { getDb } = await import("../db");
    const { pluggyConnections } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const dbConn = await getDb();
    if (!dbConn) return;

    // 1. Direct registration if clientUserId is present (preferred for new connections)
    if (body.clientUserId) {
      const userId = parseInt(body.clientUserId);
      if (!isNaN(userId)) {
        await db.upsertPluggyConnection(userId, {
          pluggyItemId: body.itemId,
          status: "updated",
          lastSyncAt: new Date(),
        });
        return;
      }
    }

    // 2. Fallback: Lookup by itemId for status updates
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
