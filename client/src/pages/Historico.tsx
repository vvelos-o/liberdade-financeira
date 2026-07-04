import { trpc } from "@/lib/trpc";
import { useMonth } from "@/contexts/MonthContext";
import { formatMoney } from "@/components/finance/MoneyDisplay";
import { CATEGORY_LABELS, CATEGORY_COLORS, VARIABLE_CATEGORIES } from "@/components/finance/CategoryBadge";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, AlertTriangle, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";

// ─── Month Comparison Card ───────────────────────────────────────────────────

function MonthComparisonCard({ currentMonth, previousMonth }: { currentMonth: any; previousMonth: any }) {
  if (!currentMonth || !previousMonth) return null;

  const categories = VARIABLE_CATEGORIES.map((cat) => {
    const current = currentMonth.categories?.find((c: any) => c.category === cat)?.spent ?? 0;
    const previous = previousMonth.categories?.find((c: any) => c.category === cat)?.spent ?? 0;
    const diff = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    return { category: cat, current, previous, diff };
  });

  const alerts = categories.filter((c) => Math.abs(c.diff) >= 20);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Comparativo Mensal
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2 pb-3 border-b border-border">
            {alerts.map((alert) => (
              <div key={alert.category} className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-foreground">
                  <span className="font-medium">{CATEGORY_LABELS[alert.category]}</span>
                  {" "}
                  {alert.diff > 0 ? "subiu" : "caiu"}
                  {" "}
                  <span className={cn("font-semibold", alert.diff > 0 ? "text-destructive" : "text-positive")}>
                    {Math.abs(alert.diff).toFixed(0)}%
                  </span>
                  {" vs mês anterior"}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Category comparison table */}
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.category} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat.category] }} />
                <span className="text-xs text-foreground">{CATEGORY_LABELS[cat.category]}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-money text-xs text-muted-foreground">{formatMoney(cat.current)}</span>
                {cat.diff !== 0 && (
                  <div className={cn("flex items-center gap-0.5 text-[10px] font-medium", cat.diff > 0 ? "text-destructive" : "text-positive")}>
                    {cat.diff > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                    {Math.abs(cat.diff).toFixed(0)}%
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Monthly Trend Bar Chart (CSS-only) ──────────────────────────────────────

function MonthlyTrendChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;

  const maxSpent = Math.max(...data.map((d) => d.totalSpent), 1);
  const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">Evolução Anual</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex items-end gap-1 h-32">
          {data.map((d, i) => {
            const height = (d.totalSpent / maxSpent) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="font-money text-[8px] text-muted-foreground">
                  {d.totalSpent > 0 ? formatMoney(d.totalSpent).replace("R$\u00a0", "") : ""}
                </span>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-sm bg-primary/60 transition-all duration-500"
                    style={{ height: `${height}%`, minHeight: d.totalSpent > 0 ? "4px" : "0" }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">{MONTH_NAMES_SHORT[d.month - 1]}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Investment Evolution ────────────────────────────────────────────────────

function InvestmentEvolution({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;

  let cumulative = 0;
  const months = data.map((d) => {
    cumulative += d.invested;
    return { ...d, cumulative };
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Investimentos Acumulados
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground">Total acumulado no ano</span>
          <span className="font-money text-lg font-semibold text-primary">{formatMoney(cumulative)}</span>
        </div>
        <div className="space-y-1.5">
          {months.filter((m) => m.invested > 0).map((m, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Mês {m.month}</span>
              <div className="flex items-center gap-3">
                <span className="font-money text-foreground">{formatMoney(m.invested)}</span>
                <Badge variant="secondary" className="text-[9px] px-1.5">{formatMoney(m.cumulative)}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Historico() {
  const { year, month } = useMonth();

  // Get current and previous month data for comparison
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const { data: currentFunnel, isLoading: loadingCurrent } = trpc.dashboard.getFunnel.useQuery({ year, month });
  const { data: previousFunnel, isLoading: loadingPrevious } = trpc.dashboard.getFunnel.useQuery({ year: prevYear, month: prevMonth });

  // Annual data
  const { data: qolHistory } = trpc.annual.getQolHistory.useQuery({ year });
  const { data: incomeHistory } = trpc.annual.getIncomeHistory.useQuery({ year });

  // Build monthly trend data from qolHistory (shape: {month, category, total}[])
  const trendData = useMemo(() => {
    if (!qolHistory) return [];
    const monthlyTotals: Record<number, number> = {};
    (qolHistory as any[]).forEach((entry) => {
      const m = entry.month;
      monthlyTotals[m] = (monthlyTotals[m] ?? 0) + parseFloat(entry.total ?? "0");
    });
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      totalSpent: monthlyTotals[i + 1] ?? 0,
    }));
  }, [qolHistory]);

  // Build investment data - use investmentTarget from budget settings
  const { data: budgetSettings } = trpc.budget.get.useQuery({ year, month });
  const investmentData = useMemo(() => {
    const target = budgetSettings?.investmentTarget ? parseFloat(budgetSettings.investmentTarget) : 0;
    if (target === 0) return [];
    // Only count from July 2026 forward
    const startYear = 2026;
    const startMonth = 7;
    const monthsSinceStart = (year - startYear) * 12 + (month - startMonth) + 1;
    if (monthsSinceStart <= 0) return [];
    return Array.from({ length: monthsSinceStart }, (_, i) => {
      const m = startMonth + i;
      const adjustedMonth = m > 12 ? m - 12 : m;
      return { month: adjustedMonth, invested: target };
    });
  }, [budgetSettings, year, month]);

  if (loadingCurrent) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-6 space-y-4 max-w-lg mx-auto">
      {/* Month Comparison */}
      <MonthComparisonCard currentMonth={currentFunnel} previousMonth={previousFunnel} />

      {/* Monthly Trend */}
      <MonthlyTrendChart data={trendData} />

      {/* Investment Evolution */}
      <InvestmentEvolution data={investmentData} />
    </div>
  );
}
