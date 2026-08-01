import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import {
  budgetSettings,
  fixedExpenseCategories,
  fixedExpenseEntries,
  incomeEntries,
  incomeSources,
  installmentExpenseMonths,
  installmentExpenses,
  monthlyInsights,
  plannedExpenses,
  pluggyTransactions,
  qolExpenses,
  DEFAULT_CATEGORY_PERCENTAGES,
} from "../../drizzle/schema";
import { getDb, DATA_CUTOFF_YEAR, DATA_CUTOFF_MONTH } from "./connection";
import { getBudgetSettings } from "./budget";

// ─── Annual History ───────────────────────────────────────────────────────────

export async function getAnnualQolHistory(userId: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  if (year < DATA_CUTOFF_YEAR) return [];

  const qolData = await db
    .select({
      month: qolExpenses.month,
      category: qolExpenses.category,
      total: sql<string>`COALESCE(SUM(${qolExpenses.amount}), 0)`,
    })
    .from(qolExpenses)
    .where(and(
      eq(qolExpenses.userId, userId),
      eq(qolExpenses.year, year),
      ...(year === DATA_CUTOFF_YEAR ? [sql`${qolExpenses.month} >= ${DATA_CUTOFF_MONTH}`] : [])
    ))
    .groupBy(qolExpenses.month, qolExpenses.category);

  const startDate = year === DATA_CUTOFF_YEAR ? new Date(year, DATA_CUTOFF_MONTH - 1, 1) : new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);
  const pluggyData: { month: number; category: string; total: string }[] = await db.execute(
    sql`SELECT MONTH(transactionDate) as month, category, COALESCE(SUM(amount), 0) as total
        FROM pluggy_transactions
        WHERE userId = ${userId} AND type = 'debit'
          AND transactionDate >= ${startDate} AND transactionDate <= ${endDate}
          AND category NOT IN ('receita', 'receita_contabilizada', 'fixo', 'investimento', 'nao_categorizado')
          AND linkedExpenseType IS NULL
        GROUP BY MONTH(transactionDate), category`
  ) as any;

  const merged = new Map<string, { month: number; category: string; total: string }>();
  for (const row of qolData) {
    const key = `${row.month}-${row.category}`;
    merged.set(key, { month: row.month, category: row.category, total: row.total });
  }
  for (const row of pluggyData) {
    const key = `${row.month}-${row.category}`;
    const existing = merged.get(key);
    if (existing) {
      existing.total = String(parseFloat(existing.total) + parseFloat(row.total));
    } else {
      merged.set(key, { month: row.month, category: row.category as string, total: row.total });
    }
  }
  return Array.from(merged.values());
}

// ─── Monthly Insights ────────────────────────────────────────────────────────

export async function getMonthlyInsight(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(monthlyInsights)
    .where(and(eq(monthlyInsights.userId, userId), eq(monthlyInsights.year, year), eq(monthlyInsights.month, month)))
    .limit(1);
  return result[0] ?? null;
}

// ─── Deterministic Insight Generator (fallback) ─────────────────────────────

const CATEGORY_LABELS_MAP: Record<string, string> = {
  lazer: "Lazer",
  alimentacao: "Alimentação",
  transporte: "Transporte",
  saude: "Saúde",
  pessoal: "Pessoal",
  imprevistos: "Imprevistos",
  outros: "Outros",
};

function generateDeterministicInsight(
  currentFunnel: NonNullable<Awaited<ReturnType<typeof getDashboardFunnel>>>,
  prevFunnel: Awaited<ReturnType<typeof getDashboardFunnel>>,
  year: number,
  month: number
): string {
  const insights: string[] = [];
  const now = new Date();
  const daysInMonth = new Date(year, month, 0).getDate();
  const currentDay = year === now.getFullYear() && month === now.getMonth() + 1 ? now.getDate() : daysInMonth;
  const monthProgress = currentDay / daysInMonth;

  // 1. Categories over budget
  const overBudget = currentFunnel.categories
    .filter(c => c.budget > 0 && c.spent > c.budget)
    .sort((a, b) => (b.spent - b.budget) - (a.spent - a.budget));

  if (overBudget.length > 0) {
    const worst = overBudget[0];
    const overBy = worst.spent - worst.budget;
    const label = CATEGORY_LABELS_MAP[worst.category] || worst.category;
    insights.push(`${label} estourou o orçamento em R$ ${overBy.toFixed(0)} (${Math.round((worst.spent / worst.budget) * 100)}% do limite). Tente segurar os gastos nessa categoria até o fim do mês.`);
  }

  // 2. Categories on pace to exceed budget
  if (insights.length === 0) {
    const atRisk = currentFunnel.categories
      .filter(c => c.budget > 0 && c.spent <= c.budget && monthProgress > 0)
      .filter(c => {
        const projectedSpend = c.spent / monthProgress;
        return projectedSpend > c.budget * 1.15; // projected to exceed by 15%+
      })
      .sort((a, b) => {
        const projA = a.spent / monthProgress;
        const projB = b.spent / monthProgress;
        return (projB / b.budget) - (projA / a.budget);
      });

    if (atRisk.length > 0) {
      const worst = atRisk[0];
      const projected = worst.spent / monthProgress;
      const label = CATEGORY_LABELS_MAP[worst.category] || worst.category;
      insights.push(`Nesse ritmo, ${label} vai fechar em ~R$ ${projected.toFixed(0)} (orçamento: R$ ${worst.budget.toFixed(0)}). Considere reduzir gastos nos próximos ${daysInMonth - currentDay} dias.`);
    }
  }

  // 3. Comparison with previous month
  if (prevFunnel && insights.length === 0) {
    const improvements = currentFunnel.categories
      .map(c => {
        const prev = prevFunnel.categories.find(p => p.category === c.category);
        if (!prev || prev.spent === 0) return null;
        const diff = ((c.spent - prev.spent) / prev.spent) * 100;
        return { ...c, diff, prevSpent: prev.spent };
      })
      .filter(Boolean) as Array<{ category: string; spent: number; diff: number; prevSpent: number }>;

    const bigDrop = improvements.filter(c => c.diff < -20).sort((a, b) => a.diff - b.diff);
    const bigRise = improvements.filter(c => c.diff > 30).sort((a, b) => b.diff - a.diff);

    if (bigDrop.length > 0) {
      const best = bigDrop[0];
      const label = CATEGORY_LABELS_MAP[best.category] || best.category;
      insights.push(`Parabéns! ${label} está ${Math.abs(best.diff).toFixed(0)}% abaixo do mês passado (R$ ${best.spent.toFixed(0)} vs R$ ${best.prevSpent.toFixed(0)}). Continue assim!`);
    } else if (bigRise.length > 0) {
      const worst = bigRise[0];
      const label = CATEGORY_LABELS_MAP[worst.category] || worst.category;
      insights.push(`${label} subiu ${worst.diff.toFixed(0)}% vs mês anterior (R$ ${worst.spent.toFixed(0)} vs R$ ${worst.prevSpent.toFixed(0)}). Vale revisar se há gastos que podem ser cortados.`);
    }
  }

  // 4. Overall health
  if (insights.length === 0) {
    const totalSpent = currentFunnel.categories.reduce((sum, c) => sum + c.spent, 0);
    const totalBudget = currentFunnel.disponivel;
    if (totalBudget > 0) {
      const usagePercent = (totalSpent / totalBudget) * 100;
      if (usagePercent < monthProgress * 80) {
        const remaining = totalBudget - totalSpent;
        insights.push(`Ótimo controle! Você usou ${usagePercent.toFixed(0)}% do disponível com ${Math.round(monthProgress * 100)}% do mês passado. Ainda tem R$ ${remaining.toFixed(0)} de folga.`);
      } else {
        insights.push(`Você já usou ${usagePercent.toFixed(0)}% do disponível (R$ ${totalSpent.toFixed(0)} de R$ ${totalBudget.toFixed(0)}). Faltam ${daysInMonth - currentDay} dias — tente manter gastos no mínimo.`);
      }
    } else {
      insights.push(`Seus gastos fixos e investimentos consomem toda a renda este mês. Revise compromissos para liberar margem.`);
    }
  }

  return insights[0] || "Seus dados financeiros estão em dia. Continue monitorando!";
}

// ─── Generate Monthly Insight (LLM with deterministic fallback) ──────────────

export async function generateMonthlyInsight(userId: number, year: number, month: number) {
  const currentFunnel = await getDashboardFunnel(userId, year, month);
  if (!currentFunnel) throw new Error("Sem dados financeiros para gerar insight neste mês.");

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevFunnel = await getDashboardFunnel(userId, prevYear, prevMonth);

  let content: string;

  // Try LLM first (with 15s timeout), fall back to deterministic
  try {
    const { invokeLLM } = await import("../_core/llm");

    const categoriesStr = currentFunnel.categories
      .filter(c => c.spent > 0)
      .map(c => `${c.category}: R$ ${c.spent.toFixed(2)} / R$ ${c.budget.toFixed(2)} (${c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0}%)`)
      .join(", ");

    const prevSection = prevFunnel ? `\nMês anterior (${prevYear}/${prevMonth}):\n- Renda: R$ ${prevFunnel.totalIncome.toFixed(2)}\n- Gastos fixos: R$ ${prevFunnel.totalFixed.toFixed(2)}\n- Disponível: R$ ${prevFunnel.disponivel.toFixed(2)}\n- Categorias: ${prevFunnel.categories.filter(c => c.spent > 0).map(c => `${c.category}: R$ ${c.spent.toFixed(2)}`).join(", ")}` : "(Sem dados do mês anterior para comparação)";

    const prompt = `Você é um consultor financeiro pessoal. Gere UM insight curto e acionável (máximo 2 frases) para o usuário baseado nos dados abaixo.

Mês atual (${year}/${month}):
- Renda total: R$ ${currentFunnel.totalIncome.toFixed(2)} (Fixa: R$ ${currentFunnel.manualFixedIncome.toFixed(2)} + Extras: R$ ${currentFunnel.totalExtraIncome.toFixed(2)})
- Gastos fixos: R$ ${currentFunnel.totalFixed.toFixed(2)}
- Investimento: R$ ${currentFunnel.effectiveInvestment.toFixed(2)} (Meta: R$ ${currentFunnel.investmentTarget.toFixed(2)})
- Compromissos: R$ ${currentFunnel.totalCompromissos.toFixed(2)}
- Disponível para variável: R$ ${currentFunnel.disponivel.toFixed(2)}
- Gastos por categoria: ${categoriesStr}
${prevSection}

Regras:
- Seja específico com valores em R$
- Sugira uma ação concreta
- Use tom amigável mas direto
- Responda APENAS o insight, sem título ou prefixo`;

    // Wrap LLM call with 15s timeout to avoid Railway request timeout
    const llmPromise = invokeLLM({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você é um consultor financeiro pessoal brasileiro. Responda em português." },
        { role: "user", content: prompt },
      ],
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("LLM timeout (15s)")), 15_000)
    );
    const response = await Promise.race([llmPromise, timeoutPromise]);

    const rawContent = response.choices?.[0]?.message?.content;
    content = typeof rawContent === "string" ? rawContent.trim() : "";
    if (!content) throw new Error("LLM retornou resposta vazia");
  } catch (llmError: any) {
    console.warn("[Insights] LLM failed, using deterministic fallback:", llmError?.message);
    content = generateDeterministicInsight(currentFunnel, prevFunnel, year, month);
  }

  // Save to DB
  const db = await getDb();
  if (!db) throw new Error("Erro de conexão com o banco de dados.");

  try {
    // Try update first (most common case: regenerating)
    const existing = await db
      .select({ id: monthlyInsights.id })
      .from(monthlyInsights)
      .where(and(
        eq(monthlyInsights.userId, userId),
        eq(monthlyInsights.year, year),
        eq(monthlyInsights.month, month)
      ))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(monthlyInsights)
        .set({ content, isDismissed: false })
        .where(eq(monthlyInsights.id, existing[0].id));
    } else {
      await db
        .insert(monthlyInsights)
        .values({ userId, year, month, content });
    }
  } catch (dbError: any) {
    console.error("[Insights] DB save failed:", dbError?.message);
    // Still return the content even if DB save fails
    return { content, isDismissed: false };
  }

  return { content, isDismissed: false };
}

export async function dismissMonthlyInsight(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(monthlyInsights)
    .set({ isDismissed: true })
    .where(and(eq(monthlyInsights.userId, userId), eq(monthlyInsights.year, year), eq(monthlyInsights.month, month)));
}

// ─── Dashboard Funnel (v2 model) ────────────────────────────────────────

export async function getDashboardFunnel(userId: number, year: number, month: number) {
  if (year < DATA_CUTOFF_YEAR || (year === DATA_CUTOFF_YEAR && month < DATA_CUTOFF_MONTH)) return null;
  const db = await getDb();
  if (!db) return null;
  try {

  const fixedIncomeResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${incomeEntries.amount}), 0)` })
    .from(incomeEntries)
    .innerJoin(incomeSources, eq(incomeEntries.sourceId, incomeSources.id))
    .where(and(
      eq(incomeEntries.userId, userId),
      eq(incomeEntries.year, year),
      eq(incomeEntries.month, month),
            eq(incomeSources.isActive, true),
      eq(incomeSources.type, "fixed")
    ));
  const manualFixedIncome = parseFloat(fixedIncomeResult[0]?.total ?? "0");

  const extraIncomeResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${incomeEntries.amount}), 0)` })
    .from(incomeEntries)
    .innerJoin(incomeSources, eq(incomeEntries.sourceId, incomeSources.id))
    .where(and(
      eq(incomeEntries.userId, userId),
      eq(incomeEntries.year, year),
      eq(incomeEntries.month, month),
      eq(incomeSources.isActive, true),
      inArray(incomeSources.type, ["extra", "variable"])
    ));
  const manualExtraIncome = parseFloat(extraIncomeResult[0]?.total ?? "0");
  const manualIncome = manualFixedIncome + manualExtraIncome;

  const incomeStartDate = new Date(year, month - 1, 1);
  const incomeEndDate = new Date(year, month, 0, 23, 59, 59);
  const pluggyExtraIncomeResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${pluggyTransactions.amount}), 0)` })
    .from(pluggyTransactions)
    .where(
      and(
        eq(pluggyTransactions.userId, userId),
        eq(pluggyTransactions.type, "credit"),
        eq(pluggyTransactions.category, "receita"),
        gte(pluggyTransactions.transactionDate, incomeStartDate),
        lte(pluggyTransactions.transactionDate, incomeEndDate)
      )
    );
  const pluggyExtraIncome = parseFloat(pluggyExtraIncomeResult[0]?.total ?? "0");
  const totalIncome = manualIncome + pluggyExtraIncome;
  const totalExtraIncome = manualExtraIncome + pluggyExtraIncome;

  const fixedResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${fixedExpenseEntries.amount}), 0)` })
    .from(fixedExpenseEntries)
    .innerJoin(fixedExpenseCategories, eq(fixedExpenseEntries.categoryId, fixedExpenseCategories.id))
    .where(and(
      eq(fixedExpenseEntries.userId, userId),
      eq(fixedExpenseEntries.year, year),
      eq(fixedExpenseEntries.month, month),
      eq(fixedExpenseCategories.isActive, true)
    ));
  const totalFixed = parseFloat(fixedResult[0]?.total ?? "0");

  let investmentTarget = 0;
  let categoryPercentages: Record<string, number> = DEFAULT_CATEGORY_PERCENTAGES;
  try {
    const budget = await getBudgetSettings(userId, year, month);
    investmentTarget = parseFloat(budget?.investmentTarget ?? "0");
    const rawPercentages = budget?.categoryPercentages;
    if (rawPercentages && Object.keys(rawPercentages).length > 0) {
      categoryPercentages = rawPercentages;
    }
  } catch (budgetErr) {
    console.error("[getDashboardFunnel] getBudgetSettings failed (using defaults):", budgetErr);
  }

  const installmentResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${installmentExpenseMonths.amount}), 0)` })
    .from(installmentExpenseMonths)
    .innerJoin(installmentExpenses, eq(installmentExpenseMonths.installmentExpenseId, installmentExpenses.id))
    .where(and(
      eq(installmentExpenseMonths.userId, userId),
      eq(installmentExpenseMonths.year, year),
      eq(installmentExpenseMonths.month, month),
      eq(installmentExpenses.isActive, true)
    ));
  const totalInstallments = parseFloat(installmentResult[0]?.total ?? "0");

  const plannedResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${plannedExpenses.amount}), 0)` })
    .from(plannedExpenses)
    .where(and(eq(plannedExpenses.userId, userId), eq(plannedExpenses.year, year), eq(plannedExpenses.month, month)));
  const totalPlanned = parseFloat(plannedResult[0]?.total ?? "0");

  const totalCompromissos = totalInstallments + totalPlanned;

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const investmentRealResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${pluggyTransactions.amount}), 0)` })
    .from(pluggyTransactions)
    .where(
      and(
        eq(pluggyTransactions.userId, userId),
        eq(pluggyTransactions.type, "debit"),
        eq(pluggyTransactions.category, "investimento" as any),
        gte(pluggyTransactions.transactionDate, startDate),
        lte(pluggyTransactions.transactionDate, endDate)
      )
    );
  const realInvestment = parseFloat(investmentRealResult[0]?.total ?? "0");
  const effectiveInvestment = Math.max(investmentTarget, realInvestment);

  const disponivel = Math.max(0, totalIncome - totalFixed - effectiveInvestment - totalCompromissos);

  const qolByCategory = await db
    .select({
      category: qolExpenses.category,
      total: sql<string>`COALESCE(SUM(${qolExpenses.amount}), 0)`,
    })
    .from(qolExpenses)
    .where(and(eq(qolExpenses.userId, userId), eq(qolExpenses.year, year), eq(qolExpenses.month, month)))
    .groupBy(qolExpenses.category);

  const variableCategories = ["lazer", "alimentacao", "transporte", "saude", "pessoal", "imprevistos", "outros"];
  const pluggyByCategory = await db
    .select({
      category: pluggyTransactions.category,
      total: sql<string>`COALESCE(SUM(${pluggyTransactions.amount}), 0)`,
    })
    .from(pluggyTransactions)
    .where(
      and(
        eq(pluggyTransactions.userId, userId),
        eq(pluggyTransactions.type, "debit"),
        inArray(pluggyTransactions.category, variableCategories as any),
        isNull(pluggyTransactions.linkedExpenseType),
        gte(pluggyTransactions.transactionDate, startDate),
        lte(pluggyTransactions.transactionDate, endDate)
      )
    )
    .groupBy(pluggyTransactions.category);

  const pluggyCreditsByCategory = await db
    .select({
      category: pluggyTransactions.category,
      total: sql<string>`COALESCE(SUM(${pluggyTransactions.amount}), 0)`,
    })
    .from(pluggyTransactions)
    .where(
      and(
        eq(pluggyTransactions.userId, userId),
        eq(pluggyTransactions.type, "credit"),
        inArray(pluggyTransactions.category, variableCategories as any),
        gte(pluggyTransactions.transactionDate, startDate),
        lte(pluggyTransactions.transactionDate, endDate)
      )
    )
    .groupBy(pluggyTransactions.category);

  const plannedByCategory = await db
    .select({
      category: plannedExpenses.category,
      total: sql<string>`COALESCE(SUM(${plannedExpenses.amount}), 0)`,
    })
    .from(plannedExpenses)
    .where(and(eq(plannedExpenses.userId, userId), eq(plannedExpenses.year, year), eq(plannedExpenses.month, month)))
    .groupBy(plannedExpenses.category);

  const installmentByCategory = await db
    .select({
      category: installmentExpenses.category,
      total: sql<string>`COALESCE(SUM(${installmentExpenseMonths.amount}), 0)`,
    })
    .from(installmentExpenseMonths)
    .innerJoin(installmentExpenses, eq(installmentExpenseMonths.installmentExpenseId, installmentExpenses.id))
    .where(and(
      eq(installmentExpenseMonths.userId, userId),
      eq(installmentExpenseMonths.year, year),
      eq(installmentExpenseMonths.month, month),
      eq(installmentExpenses.isActive, true)
    ))
    .groupBy(installmentExpenses.category);

  const spendingMap = new Map<string, number>();
  for (const row of qolByCategory) {
    spendingMap.set(row.category, (spendingMap.get(row.category) ?? 0) + parseFloat(row.total));
  }
  for (const row of pluggyByCategory) {
    const cat = row.category as string;
    spendingMap.set(cat, (spendingMap.get(cat) ?? 0) + parseFloat(row.total));
  }
  for (const row of plannedByCategory) {
    const cat = row.category as string;
    spendingMap.set(cat, (spendingMap.get(cat) ?? 0) + parseFloat(row.total));
  }
  for (const row of installmentByCategory) {
    const cat = row.category as string;
    spendingMap.set(cat, (spendingMap.get(cat) ?? 0) + parseFloat(row.total));
  }
  for (const row of pluggyCreditsByCategory) {
    const cat = row.category as string;
    const current = spendingMap.get(cat) ?? 0;
    spendingMap.set(cat, Math.max(0, current - parseFloat(row.total)));
  }

  const categories = Object.entries(categoryPercentages).map(([cat, pct]) => {
    const pctValue = (pct as number) > 1 ? (pct as number) / 100 : (pct as number);
    const budget = disponivel * pctValue;
    const spent = spendingMap.get(cat) ?? 0;
    return { category: cat, budget, spent, percentage: pct as number };
  });

  return {
    totalIncome,
    manualIncome,
    manualFixedIncome,
    totalExtraIncome,
    pluggyExtraIncome,
    totalFixed,
    investmentTarget,
    realInvestment,
    effectiveInvestment,
    totalCompromissos,
    totalInstallments,
    totalPlanned,
    disponivel,
    categories,
    categoryPercentages,
  };
  } catch (error) {
    console.error("[getDashboardFunnel] Error:", error);
    const defaultPercentages = DEFAULT_CATEGORY_PERCENTAGES;
    return {
      totalIncome: 0,
      manualIncome: 0,
      manualFixedIncome: 0,
      totalExtraIncome: 0,
      pluggyExtraIncome: 0,
      totalFixed: 0,
      investmentTarget: 0,
      realInvestment: 0,
      effectiveInvestment: 0,
      totalCompromissos: 0,
      totalInstallments: 0,
      totalPlanned: 0,
      disponivel: 0,
      categories: Object.entries(defaultPercentages).map(([cat, pct]) => ({
        category: cat, budget: 0, spent: 0, percentage: pct as number,
      })),
      categoryPercentages: defaultPercentages,
    };
  }
}

// ─── Investment History ─────────────────────────────────────────────────────

export async function getInvestmentHistory(userId: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  if (year < DATA_CUTOFF_YEAR) return [];

  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);

  let monthlyInvestments: Array<{ month: number; total: string }> = [];
  try {
    monthlyInvestments = await db
      .select({
        month: sql<number>`MONTH(${pluggyTransactions.transactionDate})`,
        total: sql<string>`COALESCE(SUM(${pluggyTransactions.amount}), 0)`,
      })
      .from(pluggyTransactions)
      .where(
        and(
          eq(pluggyTransactions.userId, userId),
          eq(pluggyTransactions.type, "debit"),
          eq(pluggyTransactions.category, "investimento" as any),
          gte(pluggyTransactions.transactionDate, startDate),
          lte(pluggyTransactions.transactionDate, endDate)
        )
      )
      .groupBy(sql`MONTH(${pluggyTransactions.transactionDate})`);
  } catch (e) {
    console.error("[getInvestmentHistory] query failed:", (e as Error).message?.slice(0, 100));
  }

  const budgetRows = await db
    .select({
      month: budgetSettings.month,
      investmentTarget: budgetSettings.investmentTarget,
    })
    .from(budgetSettings)
    .where(
      and(
        eq(budgetSettings.userId, userId),
        eq(budgetSettings.year, year)
      )
    );

  const investmentMap = new Map<number, number>();
  for (const row of monthlyInvestments) {
    investmentMap.set(row.month, parseFloat(row.total));
  }

  const targetMap = new Map<number, number>();
  for (const row of budgetRows) {
    targetMap.set(row.month, parseFloat(row.investmentTarget ?? "0"));
  }

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    if (year === DATA_CUTOFF_YEAR && month < DATA_CUTOFF_MONTH) {
      return { month, realInvestment: 0, target: 0 };
    }
    const realInvestment = investmentMap.get(month) ?? 0;
    const target = targetMap.get(month) ?? 0;
    return { month, realInvestment, target };
  });
}

// ─── Category Transaction Details ─────────────────────────────────────────────

export async function getCategoryTransactions(userId: number, year: number, month: number, category: string) {
  const cat = category as any;
  if (year < DATA_CUTOFF_YEAR || (year === DATA_CUTOFF_YEAR && month < DATA_CUTOFF_MONTH)) return [];
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  type TransactionDetail = { description: string; amount: number; source: string; date: string };
  const results: TransactionDetail[] = [];

  const pluggyRows = await db
    .select({
      description: pluggyTransactions.description,
      amount: pluggyTransactions.amount,
      date: pluggyTransactions.transactionDate,
    })
    .from(pluggyTransactions)
    .where(and(
      eq(pluggyTransactions.userId, userId),
      eq(pluggyTransactions.type, "debit"),
      eq(pluggyTransactions.category, cat),
      isNull(pluggyTransactions.linkedExpenseType),
      gte(pluggyTransactions.transactionDate, startDate),
      lte(pluggyTransactions.transactionDate, endDate)
    ))
    .orderBy(pluggyTransactions.transactionDate);

  for (const row of pluggyRows) {
    results.push({
      description: row.description ?? "Transação Pluggy",
      amount: parseFloat(String(row.amount)),
      source: "pluggy",
      date: row.date ? new Date(row.date).toISOString().slice(0, 10) : "",
    });
  }

  const pluggyCreditRows = await db
    .select({
      description: pluggyTransactions.description,
      amount: pluggyTransactions.amount,
      date: pluggyTransactions.transactionDate,
    })
    .from(pluggyTransactions)
    .where(and(
      eq(pluggyTransactions.userId, userId),
      eq(pluggyTransactions.type, "credit"),
      eq(pluggyTransactions.category, cat),
      gte(pluggyTransactions.transactionDate, startDate),
      lte(pluggyTransactions.transactionDate, endDate)
    ))
    .orderBy(pluggyTransactions.transactionDate);

  for (const row of pluggyCreditRows) {
    results.push({
      description: `(Crédito) ${row.description ?? "Reembolso"}`,
      amount: -parseFloat(String(row.amount)),
      source: "pluggy_credit",
      date: row.date ? new Date(row.date).toISOString().slice(0, 10) : "",
    });
  }

  const qolRows = await db
    .select({
      description: qolExpenses.description,
      amount: qolExpenses.amount,
    })
    .from(qolExpenses)
    .where(and(
      eq(qolExpenses.userId, userId),
      eq(qolExpenses.year, year),
      eq(qolExpenses.month, month),
      eq(qolExpenses.category, cat)
    ));

  for (const row of qolRows) {
    results.push({
      description: row.description ?? "Gasto manual",
      amount: parseFloat(String(row.amount)),
      source: "manual",
      date: "",
    });
  }

  const plannedRows = await db
    .select({
      description: plannedExpenses.description,
      amount: plannedExpenses.amount,
    })
    .from(plannedExpenses)
    .where(and(
      eq(plannedExpenses.userId, userId),
      eq(plannedExpenses.year, year),
      eq(plannedExpenses.month, month),
      eq(plannedExpenses.category, cat)
    ));

  for (const row of plannedRows) {
    results.push({
      description: `(Programado) ${row.description ?? "Gasto programado"}`,
      amount: parseFloat(String(row.amount)),
      source: "planned",
      date: "",
    });
  }

  const installmentRows = await db
    .select({
      description: installmentExpenses.description,
      amount: installmentExpenseMonths.amount,
    })
    .from(installmentExpenseMonths)
    .innerJoin(installmentExpenses, eq(installmentExpenseMonths.installmentExpenseId, installmentExpenses.id))
    .where(and(
      eq(installmentExpenseMonths.userId, userId),
      eq(installmentExpenseMonths.year, year),
      eq(installmentExpenseMonths.month, month),
      eq(installmentExpenses.category, cat),
      eq(installmentExpenses.isActive, true)
    ));

  for (const row of installmentRows) {
    results.push({
      description: `(Parcela) ${row.description ?? "Parcela"}`,
      amount: parseFloat(String(row.amount)),
      source: "installment",
      date: "",
    });
  }

  results.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  return results;
}

fix: ignorar fontes de renda inativas no dashboard
