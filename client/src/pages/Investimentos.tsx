import { trpc } from "@/lib/trpc";
import { useMonth } from "@/contexts/MonthContext";
import { formatMoney } from "@/components/finance/MoneyDisplay";
import { cn } from "@/lib/utils";
import { TrendingUp, Target, CheckCircle2, AlertCircle, Zap, Repeat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";

const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// ─── Circular Gauge ──────────────────────────────────────────────────────────

function CircularGauge({ value, target, size = 180 }: { value: number; target: number; size?: number }) {
  const percentage = target > 0 ? (value / target) * 100 : 0;
  const cappedPercentage = Math.min(percentage, 200); // Cap visual at 200%
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(cappedPercentage, 100) / 100) * circumference;
  const exceeded = percentage > 100;

  // Color based on progress
  const getColor = () => {
    if (exceeded) return "text-primary"; // Green glow when exceeded
    if (percentage >= 80) return "text-emerald-400";
    if (percentage >= 50) return "text-amber-400";
    return "text-muted-foreground";
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn("transition-all duration-1000 ease-out", getColor())}
          style={exceeded ? { filter: "drop-shadow(0 0 6px currentColor)" } : undefined}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn(
          "font-money text-3xl font-bold",
          exceeded ? "text-primary" : "text-foreground"
        )}>
          {percentage.toFixed(0)}%
        </span>
        <span className="text-[10px] text-muted-foreground mt-0.5">da meta</span>
      </div>
    </div>
  );
}

// ─── Sparkline (6 months) ────────────────────────────────────────────────────

function Sparkline({ data }: { data: Array<{ month: number; realInvestment: number }> }) {
  if (!data || data.length < 2) return null;

  const values = data.map(d => d.realInvestment);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;

  const width = 200;
  const height = 48;
  const padding = 4;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * usableWidth;
    const y = padding + usableHeight - ((v - min) / range) * usableHeight;
    return `${x},${y}`;
  });

  const pathD = points.reduce((acc, point, i) => {
    return i === 0 ? `M ${point}` : `${acc} L ${point}`;
  }, "");

  // Area fill
  const areaD = `${pathD} L ${padding + usableWidth},${height - padding} L ${padding},${height - padding} Z`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-12" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparkline-gradient)" />
        <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {points.map((point, i) => {
          const [x, y] = point.split(",");
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill={i === points.length - 1 ? "var(--color-primary)" : "var(--color-muted-foreground)"}
              opacity={i === points.length - 1 ? 1 : 0.5}
            />
          );
        })}
      </svg>
      {/* Month labels */}
      <div className="flex justify-between px-1 mt-1">
        {data.map((d, i) => (
          <span key={i} className={cn(
            "text-[9px]",
            i === data.length - 1 ? "text-primary font-medium" : "text-muted-foreground"
          )}>
            {MONTH_NAMES_SHORT[d.month - 1]}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Current Month Card with Gauge ───────────────────────────────────────────

function CurrentMonthCard({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-44 w-44 rounded-full mx-auto" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { investmentTarget, realInvestment } = data;
  const exceeded = realInvestment > investmentTarget;
  const metTarget = realInvestment >= investmentTarget && investmentTarget > 0;

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
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

        {/* Circular Gauge */}
        <div className="flex justify-center mb-4">
          <CircularGauge value={realInvestment} target={investmentTarget} />
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Investido</p>
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

        {exceeded && (
          <p className="text-xs text-primary mt-3 font-medium text-center">
            +{formatMoney(realInvestment - investmentTarget)} acima da meta!
          </p>
        )}

        {investmentTarget === 0 && realInvestment === 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 mt-3">
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

// ─── Fixed vs Extra Breakdown ────────────────────────────────────────────────

function InvestmentBreakdown({ data, investmentTarget }: { data: any; investmentTarget: number }) {
  if (!data) return null;

  // Separate fixed (up to target) from extra (above target)
  const realInvestment = data.realInvestment ?? 0;
  const fixedAmount = Math.min(realInvestment, investmentTarget);
  const extraAmount = Math.max(realInvestment - investmentTarget, 0);

  if (realInvestment === 0) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">Composição</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Fixed investment */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-primary/15">
              <Repeat className="h-3 w-3 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground">Investimento fixo</p>
              <p className="text-[10px] text-muted-foreground">Meta mensal</p>
            </div>
          </div>
          <span className="font-money text-base font-semibold text-foreground">
            {formatMoney(fixedAmount)}
          </span>
        </div>

        {/* Extra investment */}
        {extraAmount > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-amber-500/15">
                <Zap className="h-3 w-3 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-foreground">Aporte extra</p>
                <p className="text-[10px] text-muted-foreground">Acima da meta</p>
              </div>
            </div>
            <span className="font-money text-base font-semibold text-primary">
              +{formatMoney(extraAmount)}
            </span>
          </div>
        )}

        {/* Visual bar */}
        <div className="h-3 rounded-full bg-secondary overflow-hidden flex">
          <div
            className="h-full bg-primary/60 transition-all duration-500"
            style={{ width: `${investmentTarget > 0 ? (fixedAmount / realInvestment) * 100 : 100}%` }}
          />
          {extraAmount > 0 && (
            <div
              className="h-full bg-amber-400/60 transition-all duration-500"
              style={{ width: `${(extraAmount / realInvestment) * 100}%` }}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Consistency Sparkline Card ──────────────────────────────────────────────

function ConsistencyCard({ data }: { data: Array<{ month: number; realInvestment: number; target: number }> }) {
  if (!data || data.length < 2) return null;

  const hasAnyData = data.some(d => d.realInvestment > 0);
  if (!hasAnyData) return null;

  // Calculate streak
  const reversedData = [...data].reverse();
  let streak = 0;
  for (const d of reversedData) {
    if (d.realInvestment > 0) streak++;
    else break;
  }

  const totalInvested = data.reduce((sum, d) => sum + d.realInvestment, 0);
  const monthsInvesting = data.filter(d => d.realInvestment > 0).length;
  const average = monthsInvesting > 0 ? totalInvested / monthsInvesting : 0;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Consistência
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* Sparkline */}
        <Sparkline data={data.filter(d => d.realInvestment > 0 || d.target > 0)} />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
          <div className="text-center">
            <p className="font-money text-base font-bold text-foreground">{streak}</p>
            <p className="text-[9px] text-muted-foreground">meses seguidos</p>
          </div>
          <div className="text-center">
            <p className="font-money text-base font-bold text-primary">{formatMoney(totalInvested)}</p>
            <p className="text-[9px] text-muted-foreground">total no ano</p>
          </div>
          <div className="text-center">
            <p className="font-money text-base font-bold text-foreground">{formatMoney(average)}</p>
            <p className="text-[9px] text-muted-foreground">média/mês</p>
          </div>
        </div>
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
                <span className="font-money text-[8px] text-muted-foreground leading-tight text-center">
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
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-6 space-y-4 max-w-lg mx-auto">
      {/* Current Month with Gauge */}
      <CurrentMonthCard data={funnel} isLoading={loadingFunnel} />

      {/* Fixed vs Extra Breakdown */}
      <InvestmentBreakdown data={funnel} investmentTarget={funnel?.investmentTarget ?? 0} />

      {/* Consistency Sparkline */}
      <ConsistencyCard data={historyData} />

      {/* History Chart */}
      <InvestmentHistoryChart data={historyData} />
    </div>
  );
}
