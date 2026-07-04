import { trpc } from "@/lib/trpc";
import { useMonth } from "@/contexts/MonthContext";
import { MoneyDisplay, formatMoney } from "@/components/finance/MoneyDisplay";
import { CATEGORY_LABELS, CATEGORY_COLORS, VARIABLE_CATEGORIES } from "@/components/finance/CategoryBadge";
import { cn } from "@/lib/utils";
import { Lightbulb, X, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Gift, TrendingUp, PartyPopper } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { toast } from "sonner";

// ─── Funnel Summary ──────────────────────────────────────────────────────────

function FunnelSummary({ data, isLoading }: { data: any; isLoading: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { totalIncome, totalFixed, investmentTarget, totalCompromissos, disponivel } = data;

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardContent className="p-4">
        {/* Main display */}
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Disponível variável</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
            aria-label={expanded ? "Recolher detalhes" : "Expandir detalhes"}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
        <MoneyDisplay value={disponivel} size="3xl" className="block mb-1" />

        {/* Funnel breakdown (collapsible) */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border space-y-2 animate-count-up">
            <FunnelRow label="Renda" value={totalIncome} type="income" />
            <FunnelRow label="Gastos fixos" value={-totalFixed} type="expense" />
            <FunnelRow label="Investimento" value={-investmentTarget} type="expense" />
            {totalCompromissos > 0 && (
              <FunnelRow label="Compromissos" value={-totalCompromissos} type="expense" />
            )}
            <div className="border-t border-border pt-2 mt-2">
              <FunnelRow label="= Disponível" value={disponivel} type="result" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FunnelRow({ label, value, type }: { label: string; value: number; type: "income" | "expense" | "result" }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(
        "font-money font-medium",
        type === "income" && "text-positive",
        type === "expense" && "text-negative",
        type === "result" && "text-foreground font-semibold",
      )}>
        {formatMoney(value)}
      </span>
    </div>
  );
}

// ─── Insight Card ────────────────────────────────────────────────────────────

function InsightCard({ year, month }: { year: number; month: number }) {
  const { data: insight, isLoading } = trpc.insights.get.useQuery({ year, month });
  const generateMutation = trpc.insights.generate.useMutation();
  const dismissMutation = trpc.insights.dismiss.useMutation();
  const utils = trpc.useUtils();

  if (isLoading) return null;

  // If no insight exists, show generate button
  if (!insight) {
    return (
      <Card className="bg-card border-border border-dashed">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lightbulb className="h-4 w-4" />
            <span className="text-sm">Gerar insight para este mês</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              generateMutation.mutate({ year, month }, {
                onSuccess: () => utils.insights.get.invalidate({ year, month }),
                onError: () => toast.error("Não foi possível gerar o insight."),
              });
            }}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Gerar"
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // If dismissed, don't show
  if (insight.isDismissed) return null;

  return (
    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-primary/15 flex-shrink-0 mt-0.5">
            <Lightbulb className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary mb-1">Insight do mês</p>
            <p className="text-sm text-foreground leading-relaxed">{insight.content}</p>
          </div>
          <button
            onClick={() => {
              dismissMutation.mutate({ year, month }, {
                onSuccess: () => utils.insights.get.invalidate({ year, month }),
              });
            }}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            aria-label="Dispensar insight"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Category Progress Bars ──────────────────────────────────────────────────

function CategoryProgressBars({ categories, isLoading }: { categories: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <Card className="bg-card border-border border-dashed">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Configure seu orçamento em Configuração para ver as barras de progresso.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {categories.map((cat, index) => (
        <CategoryBar
          key={cat.category}
          category={cat.category}
          budget={cat.budget}
          spent={cat.spent}
          index={index}
        />
      ))}
    </div>
  );
}

function CategoryBar({ category, budget, spent, index }: {
  category: string; budget: number; spent: number; index: number;
}) {
  const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const isOverBudget = spent > budget;
  const isWarning = percentage >= 80 && !isOverBudget;
  const remaining = budget - spent;

  const barColor = isOverBudget
    ? "bg-destructive"
    : isWarning
    ? "bg-amber-400"
    : `bg-[${CATEGORY_COLORS[category] ?? "#9ca3af"}]`;

  // Use inline style for dynamic color since Tailwind can't handle dynamic values
  const barStyle = {
    width: `${Math.min(percentage, 100)}%`,
    backgroundColor: isOverBudget ? undefined : isWarning ? undefined : (CATEGORY_COLORS[category] ?? "#9ca3af"),
  };

  return (
    <div
      className="stagger-item"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {CATEGORY_LABELS[category] ?? category}
          </span>
          {isOverBudget && (
            <AlertTriangle className="h-3 w-3 text-destructive" />
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className={cn("font-money text-xs", isOverBudget ? "text-destructive" : "text-muted-foreground")}>
            {formatMoney(spent)}
          </span>
          <span className="text-[10px] text-muted-foreground">/</span>
          <span className="font-money text-[10px] text-muted-foreground">
            {formatMoney(budget)}
          </span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isOverBudget && "bg-destructive",
            isWarning && "bg-amber-400",
          )}
          style={barStyle}
        />
      </div>
      {isOverBudget && (
        <p className="text-[10px] text-destructive mt-0.5 font-medium">
          Excedeu {formatMoney(Math.abs(remaining))}
        </p>
      )}
    </div>
  );
}

// ─── Month-End Card ─────────────────────────────────────────────────────────

function MonthEndCard({ funnel }: { funnel: any }) {
  const [dismissed, setDismissed] = useState(false);
  const { year, month } = useMonth();
  const handleExtraMutation = trpc.income.handleExtra.useMutation();
  const currentDay = new Date().getDate();
  const currentMonth = new Date().getMonth() + 1;

  // Only show in the last 3 days of the month or when viewing a past month
  const daysInMonth = new Date(new Date().getFullYear(), currentMonth, 0).getDate();
  const isEndOfMonth = currentDay >= daysInMonth - 2;
  const isViewingPastMonth = month < currentMonth;

  if (dismissed || (!isEndOfMonth && !isViewingPastMonth)) return null;
  if (!funnel) return null;

  const totalSpent = funnel.categories?.reduce((sum: number, c: any) => sum + c.spent, 0) ?? 0;
  const surplus = funnel.disponivel - totalSpent;

  if (Math.abs(surplus) < 10) return null; // Ignore tiny amounts

  return (
    <Card className={cn(
      "border",
      surplus > 0 ? "bg-positive/5 border-positive/20" : "bg-destructive/5 border-destructive/20"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "p-1.5 rounded-lg flex-shrink-0 mt-0.5",
            surplus > 0 ? "bg-positive/15" : "bg-destructive/15"
          )}>
            {surplus > 0 ? <PartyPopper className="h-4 w-4 text-positive" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-xs font-medium mb-1", surplus > 0 ? "text-positive" : "text-destructive")}>
              {surplus > 0 ? "Fechamento do mês" : "Mês no vermelho"}
            </p>
            {surplus > 0 ? (
              <>
                <p className="text-sm text-foreground leading-relaxed mb-2">
                  Sobrou <span className="font-money font-semibold text-positive">{formatMoney(surplus)}</span> este mês!
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-positive hover:text-positive"
                    disabled={handleExtraMutation.isPending}
                    onClick={() => handleExtraMutation.mutate(
                      { amount: surplus.toFixed(2), action: "budget", year, month },
                      { onSuccess: () => { toast.success("Sobra adicionada ao orçamento do próximo mês!"); setDismissed(true); } }
                    )}>
                    <Gift className="h-3 w-3 mr-1" />Orçamento
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-primary hover:text-primary"
                    disabled={handleExtraMutation.isPending}
                    onClick={() => handleExtraMutation.mutate(
                      { amount: surplus.toFixed(2), action: "invest", year, month },
                      { onSuccess: () => { toast.success("Sobra direcionada para investimento extra!"); setDismissed(true); } }
                    )}>
                    <TrendingUp className="h-3 w-3 mr-1" />Investir
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-foreground leading-relaxed">
                Excedeu <span className="font-money font-semibold text-destructive">{formatMoney(Math.abs(surplus))}</span> do orçamento. O insight do próximo mês vai sugerir ajustes.
              </p>
            )}
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Inicio() {
  const { year, month } = useMonth();
  const { data: funnel, isLoading } = trpc.dashboard.getFunnel.useQuery({ year, month });

  const totalSpent = useMemo(() => {
    if (!funnel?.categories) return 0;
    return funnel.categories.reduce((sum: number, c: any) => sum + c.spent, 0);
  }, [funnel]);

  return (
    <div className="p-4 pb-6 space-y-4 max-w-lg mx-auto">
      {/* Funnel Summary */}
      <FunnelSummary data={funnel} isLoading={isLoading} />

      {/* Month-End Card (shows last 3 days or past month) */}
      <MonthEndCard funnel={funnel} />

      {/* AI Insight */}
      <InsightCard year={year} month={month} />

      {/* Category Progress Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Gastos por categoria</h2>
          {funnel && (
            <span className="font-money text-xs text-muted-foreground">
              Total: {formatMoney(totalSpent)}
            </span>
          )}
        </div>
        <CategoryProgressBars categories={funnel?.categories ?? []} isLoading={isLoading} />
      </div>
    </div>
  );
}
