import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import axios from "axios";
import { invokeLLM } from "../_core/llm";

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
  amount?: number;
  date?: string;
  type?: string;
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

      // Fetch learned rules BEFORE the sync loop so we can apply them
      const learnedRules = await db.getCategoryRules(ctx.user.id);

      let totalImported = 0;
      for (const conn of targetConnections) {
        try {
          const accounts = await getPluggyAccounts(apiKey, conn.pluggyItemId);
          for (const account of accounts) {
            const transactions = await getPluggyTransactions(apiKey, account.id, input.fromDate, input.toDate);
            for (const tx of transactions) {
              const desc = tx.description ?? "";
              // 1. Check learned rules first (higher priority, user-corrected)
              const matchedRule = learnedRules.find(r => desc.toUpperCase().includes(r.pattern.toUpperCase()));
              let category: string;
              if (matchedRule) {
                category = matchedRule.category;
              } else {
                // 2. Fall back to keyword-based auto-categorization
                category = autoCategorize(desc);
              }
              const amount = Math.abs(tx.amount ?? 0);

              await db.upsertPluggyTransaction(ctx.user.id, {
                pluggyTransactionId: tx.id,
                pluggyItemId: conn.pluggyItemId,
                accountId: account.id,
                description: desc,
                amount: String(amount),
                type: (tx.amount ?? 0) < 0 ? "debit" : "credit",
                transactionDate: new Date(tx.date ?? Date.now()),
                category: category as any,
              });

              // Auto-detect installments (X/Y pattern like "KABUM 3/8" or "PARCELA 2 DE 6")
              const installmentMatch = desc.match(/(\d{1,2})\s*[\/]\s*(\d{1,3})/) || desc.match(/(\d{1,2})\s+DE\s+(\d{1,3})/i);
              if (installmentMatch && (tx.amount ?? 0) < 0) {
                const currentInstallment = parseInt(installmentMatch[1]);
                const totalInstallments = parseInt(installmentMatch[2]);
                if (totalInstallments >= 2 && totalInstallments <= 120 && currentInstallment <= totalInstallments) {
                  // Extract clean name (remove installment pattern)
                  const cleanDesc = desc.replace(installmentMatch[0], "").trim().replace(/\s+/g, " ");
                  const txDate = new Date(tx.date ?? Date.now());
                  const startMonth = txDate.getMonth() + 1 - (currentInstallment - 1);
                  const startYear = txDate.getFullYear() + Math.floor((startMonth - 1) / 12);
                  const normalizedStartMonth = ((startMonth - 1) % 12 + 12) % 12 + 1;
                  try {
                    await db.createInstallmentExpense(ctx.user.id, {
                      description: cleanDesc || desc,
                      totalAmount: String(amount * totalInstallments),
                      installmentAmount: String(amount),
                      totalInstallments,
                      startYear: normalizedStartMonth > txDate.getMonth() + 1 ? startYear - 1 : startYear,
                      startMonth: normalizedStartMonth,
                      category: category === "nao_categorizado" ? "pessoal" : (category as any),
                    });
                  } catch { /* ignore duplicates */ }
                }
              }
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
      category: z.enum(["lazer", "alimentacao", "transporte", "saude", "pessoal", "imprevistos", "outros", "receita", "fixo", "investimento", "nao_categorizado"]),
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

  // Get uncategorized transactions (for AI review)
  getUncategorized: protectedProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(({ ctx, input }) => db.getUncategorizedTransactions(ctx.user.id, input.limit ?? 50)),

  // AI-powered bulk categorization suggestion
  aiSuggestCategories: protectedProcedure
    .input(z.object({
      transactionIds: z.array(z.number()).max(50),
    }))
    .mutation(async ({ ctx, input }) => {
      const VALID_CATEGORIES = ["lazer", "alimentacao", "transporte", "saude", "pessoal", "imprevistos", "outros", "receita", "fixo", "investimento", "nao_categorizado"] as const;

      // Get the transactions to categorize
      const allUncategorized = await db.getUncategorizedTransactions(ctx.user.id, 200);
      const toProcess = allUncategorized.filter(t => input.transactionIds.includes(t.id));

      if (toProcess.length === 0) return { suggestions: [] };

      const transactionList = toProcess
        .map(t => `ID:${t.id} | ${t.description} | R$${t.amount} | ${t.type}`)
        .join("\n");

      // Fetch learned rules to include in prompt
      const rules = await db.getCategoryRules(ctx.user.id);
      const rulesSection = rules.length > 0
        ? `\nREGRAS APRENDIDAS (use estas como prioridade, sao correcoes feitas pelo usuario):\n${rules.map(r => `- "${r.pattern}" → ${r.category} (confianca: ${r.confidence}x)`).join("\n")}\n`
        : "";

      const prompt = `Voce e um assistente especializado em financas pessoais brasileiras. Categorize cada transacao bancaria abaixo em uma das categorias disponiveis.
${rulesSection}
CATEGORIAS DISPONIVEIS:
- lazer: restaurantes, bares, streaming (Netflix, Spotify), cinema, jogos, delivery de comida (iFood, Uber Eats, Rappi, Keeta), entretenimento
- alimentacao: supermercados, mercados, padarias, acougues, hortifruti (Carrefour, Extra, Pao de Acucar, etc)
- transporte: Uber, 99, taxi, combustivel, posto, estacionamento, metro, onibus, pedagio
- saude: farmacias, drogarias, medicos, hospitais, clinicas, plano de saude, exames
- fixo: aluguel, condominio, energia, agua, internet, telefone, seguro
- investimento: investimentos, tesouro direto, fundos, acoes, CDB, XP, BTG
- receita: salario, pagamentos recebidos, transferencias recebidas, reembolsos
- outros: compras gerais, servicos diversos que nao se encaixam nas outras categorias
- nao_categorizado: apenas se for impossivel determinar a categoria

IMPORTANTE: Se a descricao da transacao corresponder a uma das REGRAS APRENDIDAS acima, USE a categoria indicada na regra com confianca "high".

TRANSACOES (formato: ID | Descricao | Valor | Tipo):
${transactionList}

Responda APENAS com JSON no formato:
{"suggestions": [{"id": <numero>, "category": "<categoria>", "confidence": "high|medium|low"}]}`;

      const response = await invokeLLM({
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "categorization_result",
            strict: true,
            schema: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer" },
                      category: { type: "string", enum: [...VALID_CATEGORIES] },
                      confidence: { type: "string", enum: ["high", "medium", "low"] },
                    },
                    required: ["id", "category", "confidence"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return { suggestions: [] };

      const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content)) as {
        suggestions: Array<{ id: number; category: string; confidence: string }>;
      };
      return parsed;
    }),

  // Apply AI-suggested or manually chosen categories (bulk)
  applyCategories: protectedProcedure
    .input(z.object({
      updates: z.array(z.object({
        id: z.number(),
        category: z.enum(["lazer", "alimentacao", "transporte", "saude", "pessoal", "imprevistos", "outros", "receita", "fixo", "investimento", "nao_categorizado"]),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.bulkUpdatePluggyTransactionCategories(input.updates, ctx.user.id);
      return { applied: input.updates.length };
    }),

  // ─── Category Rules (Learned AI) ────────────────────────────────────────────

  getRules: protectedProcedure.query(({ ctx }) => db.getCategoryRules(ctx.user.id)),

  saveRule: protectedProcedure
    .input(z.object({
      pattern: z.string().min(1),
      category: z.enum(["lazer", "alimentacao", "transporte", "saude", "pessoal", "imprevistos", "outros", "receita", "fixo", "investimento", "nao_categorizado"]),
      source: z.enum(["user_correction", "manual"]).default("user_correction"),
    }))
    .mutation(({ ctx, input }) =>
      db.upsertCategoryRule(ctx.user.id, input.pattern, input.category, input.source)
    ),

  deleteRule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => db.deleteCategoryRule(input.id, ctx.user.id)),

  // Save correction: updates the transaction category AND saves a rule for future use
  correctCategory: protectedProcedure
    .input(z.object({
      transactionId: z.number(),
      category: z.enum(["lazer", "alimentacao", "transporte", "saude", "pessoal", "imprevistos", "outros", "receita", "fixo", "investimento", "nao_categorizado"]),
      description: z.string(), // the transaction description to use as pattern
    }))
    .mutation(async ({ ctx, input }) => {
      // Update the transaction category
      await db.updatePluggyTransactionCategory(input.transactionId, ctx.user.id, input.category);
      // Extract a clean pattern from the description (remove numbers, dates, etc.)
      const pattern = input.description
        .replace(/\d{2}\/\d{2}/g, "") // remove dates
        .replace(/\d+/g, "") // remove numbers
        .replace(/\s+/g, " ") // normalize spaces
        .trim()
        .toUpperCase();
      if (pattern.length >= 3) {
        await db.upsertCategoryRule(ctx.user.id, pattern, input.category, "user_correction");
      }
      return { success: true };
    }),
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
