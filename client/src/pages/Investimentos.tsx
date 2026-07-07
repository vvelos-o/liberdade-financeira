import { trpc } from "@/lib/trpc";
import { useMonth } from "@/contexts/MonthContext";
import { formatMoney } from "@/components/finance/MoneyDisplay";
import { cn } from "@/lib/utils";
import { TrendingUp, Target, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";

const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// ─── Current Month Summary ──────────────────────────────────────────────────

function CurrentMonthCard({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { investmentTarget, realInvestment, effectiveInvestment } = data;
  const progress = investmentTarget > 0 ? Math.min((realInvestment / investmentTarget) * 100, 100) : 0;
  const exceeded = realInvestment > investmentTarget;
  const metTarget = realInvestment >= investmentTarget && investmentTarget > 0;

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/15">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Este mês</span>
          </div>
          {metTarget && (
            <Badge variant="secondary" className="text-[10px] gap-1 bg-positive/10 text-positive border-positive/20">
              <CheckCircle2 className="h-3 w-3" />
              Meta atingida
            </Badge>
          )}
        </div>

        {/* Main amounts */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Realizado</p>
            <p className={cn("font-money text-xl font-bold", realInvestment > 0 ? "text-primary" : "text-muted-foreground")}>
              {formatMoney(realInvestment)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Meta</p>
            <p className="font-money text-xl font-bold text-foreground">
              {formatMoney(investmentTarget)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {investmentTarget > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Progresso</span>
              <span className={cn("text-[10px] font-medium", exceeded ? "text-primary" : "text-muted-foreground")}>
                {progress.toFixed(0)}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  exceeded ? "bg-primary" : metTarget ? "bg-positive" : "bg-primary/60"
                )}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            {exceeded && (
              <p className="text-[10px] text-primary mt-1 font-medium">
                Investiu {formatMoney(realInvestment - investmentTarget)} acima da meta!
              </p>
            )}
          </div>
        )}

        {investmentTarget === 0 && realInvestment === 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <AlertCircle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
            <p className="text-[10px] text-muted-foreground">
              Configure sua meta de investimento em Configuração.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Monthly History Bar Chart ──────────────────────────────────────────────

function InvestmentHistoryChart({ data }: { data: Array<{ month: number; realInvestment: number; target: number }> }) {
  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => Math.max(d.realInvestment, d.target)), 1);
  const hasAnyData = data.some((d) => d.realInvestment > 0 || d.target > 0);

  if (!hasAnyData) {
    return (
      <Card className="bg-card border-border border-dashed">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Dados de investimento aparecerão aqui após sincronizar transações.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Meta vs Realizado
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Legend */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-primary/60" />
            <span className="text-[10px] text-muted-foreground">Realizado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-muted-foreground/30 border border-muted-foreground/50" />
            <span className="text-[10px] text-muted-foreground">Meta</span>
          </div>
        </div>

        {/* Chart */}
        <div className="flex items-end gap-1 h-36">
          {data.map((d, i) => {
            const realHeight = (d.realInvestment / maxValue) * 100;
            const targetHeight = (d.target / maxValue) * 100;
            const metTarget = d.realInvestment >= d.target && d.target > 0;

            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                {/* Value label */}
                <span className="font-money text-[7px] text-muted-foreground leading-tight text-center">
                  {d.realInvestment > 0 ? formatMoney(d.realInvestment).replace("R$\u00a0", "") : ""}
                </span>
                {/* Bars container */}
                <div className="w-full flex-1 flex items-end justify-center gap-[1px]">
                  {/* Target bar (background) */}
                  <div
                    className="w-[45%] rounded-t-sm bg-muted-foreground/20 border border-muted-foreground/30 transition-all duration-500"
                    style={{ height: `${targetHeight}%`, minHeight: d.target > 0 ? "3px" : "0" }}
                  />
                  {/* Real bar */}
                  <div
                    className={cn(
                      "w-[45%] rounded-t-sm transition-all duration-500",
                      metTarget ? "bg-positive/70" : "bg-primary/60"
                    )}
                    style={{ height: `${realHeight}%`, minHeight: d.realInvestment > 0 ? "3px" : "0" }}
                  />
                </div>
                {/* Month label */}
                <span className={cn(
                  "text-[9px]",
                  metTarget ? "text-positive font-medium" : "text-muted-foreground"
                )}>
                  {MONTH_NAMES_SHORT[d.month - 1]}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Cumulative Summary ─────────────────────────────────────────────────────

function CumulativeSummary({ data }: { data: Array<{ month: number; realInvestment: number; target: number }> }) {
  const stats = useMemo(() => {
    const totalReal = data.reduce((sum, d) => sum + d.realInvestment, 0);
    const totalTarget = data.reduce((sum, d) => sum + d.target, 0);
    const monthsWithInvestment = data.filter((d) => d.realInvestment > 0).length;
    const monthsMetTarget = data.filter((d) => d.realInvestment >= d.target && d.target > 0).length;
    const monthsWithTarget = data.filter((d) => d.target > 0).length;
    return { totalReal, totalTarget, monthsWithInvestment, monthsMetTarget, monthsWithTarget };
  }, [data]);

  if (stats.totalReal === 0 && stats.totalTarget === 0) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">Resumo Anual</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Total investido</p>
            <p className="font-money text-lg font-bold text-primary">{formatMoney(stats.totalReal)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Total meta</p>
            <p className="font-money text-lg font-bold text-foreground">{formatMoney(stats.totalTarget)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Meses investindo</p>
            <p className="text-lg font-bold text-foreground">{stats.monthsWithInvestment}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Meses na meta</p>
            <p className={cn("text-lg font-bold", stats.monthsMetTarget > 0 ? "text-positive" : "text-muted-foreground")}>
              {stats.monthsMetTarget}/{stats.monthsWithTarget}
            </p>
          </div>
        </div>

        {/* Monthly detail list */}
        {stats.monthsWithInvestment > 0 && (
          <div className="mt-4 pt-3 border-t border-border space-y-1.5">
            {data.filter((d) => d.realInvestment > 0 || d.target > 0).map((d) => {
              const metTarget = d.realInvestment >= d.target && d.target > 0;
              return (
                <div key={d.month} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {metTarget ? (
                      <CheckCircle2 className="h-3 w-3 text-positive" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-muted-foreground/40" />
                    )}
                    <span className="text-muted-foreground">{MONTH_NAMES_SHORT[d.month - 1]}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("font-money", metTarget ? "text-positive" : "text-foreground")}>
                      {formatMoney(d.realInvestment)}
                    </span>
                    {d.target > 0 && (
                      <span className="font-money text-muted-foreground text-[10px]">
                        / {formatMoney(d.target)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Investimentos() {
  const { year, month } = useMonth();

  const { data: funnel, isLoading: loadingFunnel } = trpc.dashboard.getFunnel.useQuery({ year, month });
  const { data: history, isLoading: loadingHistory } = trpc.annual.getInvestmentHistory.useQuery({ year });

  const historyData = useMemo(() => {
    if (!history) return [];
    return history as Array<{ month: number; realInvestment: number; target: number }>;
  }, [history]);

  if (loadingFunnel && loadingHistory) {
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
      {/* Current Month */}
      <CurrentMonthCard data={funnel} isLoading={loadingFunnel} />

      {/* History Chart */}
      <InvestmentHistoryChart data={historyData} />

      {/* Cumulative Summary */}
      <CumulativeSummary data={historyData} />
    </div>
  );
}
