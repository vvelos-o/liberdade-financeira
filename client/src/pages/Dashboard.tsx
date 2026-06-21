import { useMonth } from "@/contexts/MonthContext";
import { trpc } from "@/lib/trpc";
import { MoneyDisplay, formatMoneyCompact } from "@/components/finance/MoneyDisplay";
import { CategoryBadge, CATEGORY_COLORS } from "@/components/finance/CategoryBadge";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Wallet, Target, Zap,
  ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2,
  CreditCard, Calendar, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { formatMoney } from "@/components/finance/MoneyDisplay";
import { useState } from "react";

const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function StatCard({ title, value, subtitle, icon: Icon, trend, colorClass, isLoading }: {
  title: string; value: number; subtitle?: string; icon: React.ElementType;
  trend?: { value: number; label: string }; colorClass: string; isLoading?: boolean;
}) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="bg-card border-border card-hover relative overflow-hidden">
        <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-8 translate-x-8 opacity-10", colorClass.replace("text-", "bg-"))} />
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className={cn("p-2 rounded-lg", colorClass.replace("text-", "bg-") + "/15")}>
              <Icon className={cn("h-4 w-4", colorClass)} />
            </div>
            {trend && (
              <div className={cn("flex items-center gap-1 text-xs font-medium", trend.value >= 0 ? "text-positive" : "text-negative")}>
                {trend.value >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(trend.value).toFixed(1)}%
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-medium mb-1">{title}</p>
          {isLoading ? (
            <Skeleton className="h-7 w-32 mb-1" />
          ) : (
            <MoneyDisplay value={value} size="2xl" colorize={title === "Saldo Projetado"} />
          )}
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Dashboard() {
  const { year, month, monthLabel } = useMonth();
  const [syncLoading, setSyncLoading] = useState(false);

  const { data: summary, isLoading } = trpc.dashboard.getSummary.useQuery({ year, month });
  const { data: recentTxs } = trpc.dashboard.getRecentTransactions.useQuery({ limit: 8 });
  const { data: pluggyStatus } = trpc.pluggy.getStatus.useQuery();

  const syncMutation = trpc.pluggy.syncTransactions.useMutation({
    onSuccess: (data) => {
      setSyncLoading(false);
      if (data.totalImported > 0) {
        // toast success handled by parent
      }
    },
    onError: () => setSyncLoading(false),
  });

  const qolData = summary?.qolByCategory?.map((item) => ({
    name: item.category === "lazer" ? "Lazer" :
          item.category === "alimentacao" ? "Alimentação" :
          item.category === "transporte" ? "Transporte" :
          item.category === "saude" ? "Saúde" : "Outros",
    value: item.total,
    color: CATEGORY_COLORS[item.category as keyof typeof CATEGORY_COLORS] ?? "#9ca3af",
  })).filter((d) => d.value > 0) ?? [];

  const totalExpenses = summary?.totalExpenses ?? 0;
  const totalIncome = summary?.totalIncome ?? 0;
  const balance = summary?.balance ?? 0;
  const fcp = summary?.fcp ?? 0;
  const budgetUsedPct = summary?.baseMonthlyBudget ? (totalExpenses / summary.baseMonthlyBudget) * 100 : 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-popover border border-border rounded-xl p-3 shadow-elevated">
          <p className="text-xs text-muted-foreground mb-1">{payload[0].name}</p>
          <p className="text-sm font-bold text-foreground font-money">{formatMoney(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        {pluggyStatus?.configured && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSyncLoading(true); syncMutation.mutate({}); }}
            disabled={syncLoading}
            className="gap-2"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncLoading && "animate-spin")} />
            Sincronizar
          </Button>
        )}
      </div>

      {/* Main Stats */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4"
      >
        <StatCard
          title="Receita Total"
          value={totalIncome}
          icon={TrendingUp}
          colorClass="text-emerald-400"
          isLoading={isLoading}
          subtitle={`${summary?.investmentRate ? (summary.investmentRate * 100).toFixed(0) : 15}% para investir`}
        />
        <StatCard
          title="Gastos Totais"
          value={totalExpenses}
          icon={TrendingDown}
          colorClass="text-rose-400"
          isLoading={isLoading}
          subtitle={`${budgetUsedPct.toFixed(0)}% do orçamento`}
        />
        <StatCard
          title="Saldo Projetado"
          value={balance}
          icon={Wallet}
          colorClass={balance >= 0 ? "text-blue-400" : "text-rose-400"}
          isLoading={isLoading}
        />
        <StatCard
          title="FCP (Crescimento)"
          value={fcp}
          icon={Zap}
          colorClass="text-yellow-400"
          isLoading={isLoading}
          subtitle="R × P × I anualizado"
        />
      </motion.div>

      {/* Budget Progress */}
      {summary?.baseMonthlyBudget && summary.baseMonthlyBudget > 0 && (
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {budgetUsedPct > 100 ? (
                    <AlertTriangle className="h-4 w-4 text-warning" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-positive" />
                  )}
                  <span className="text-sm font-medium text-foreground">Orçamento Base Mensal</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    <MoneyDisplay value={totalExpenses} size="xs" /> de <MoneyDisplay value={summary.baseMonthlyBudget} size="xs" />
                  </span>
                  <Badge variant={budgetUsedPct > 100 ? "destructive" : "secondary"} className="text-xs">
                    {budgetUsedPct.toFixed(0)}%
                  </Badge>
                </div>
              </div>
              <Progress
                value={Math.min(budgetUsedPct, 100)}
                className="h-2"
              />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* QoL Donut Chart */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Qualidade de Vida</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {qolData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={qolData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                        {qolData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {qolData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-xs text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="text-xs font-medium font-money text-foreground">{formatMoneyCompact(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                  Nenhum gasto registrado
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Expense Breakdown */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Composição dos Gastos</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <div className="space-y-3 pt-2">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  {[
                    { label: "Gastos Fixos", value: summary?.totalFixed ?? 0, color: "bg-yellow-400" },
                    { label: "Qualidade de Vida", value: summary?.totalQol ?? 0, color: "bg-purple-400" },
                    { label: "Parcelamentos", value: summary?.totalInstallments ?? 0, color: "bg-blue-400" },
                    { label: "Programados", value: summary?.totalPlanned ?? 0, color: "bg-orange-400" },
                  ].map((item) => {
                    const pct = totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0;
                    return (
                      <div key={item.label}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-full", item.color)} />
                            <span className="text-xs text-muted-foreground">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium font-money text-foreground">{formatMoneyCompact(item.value)}</span>
                            <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className={cn("h-full rounded-full", item.color)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* FCP Card */}
      <motion.div variants={itemVariants} initial="hidden" animate="visible">
        <Card className="bg-card border-border border-gradient overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm font-semibold text-foreground">FCP — Fator de Crescimento de Patrimônio</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">CP = R × P × I</p>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Renda (R)</p>
                    <MoneyDisplay value={totalIncome} size="sm" />
                  </div>
                  <div className="text-muted-foreground text-lg">×</div>
                  <div>
                    <p className="text-xs text-muted-foreground">% Poupada (P)</p>
                    <span className="text-sm font-bold font-money text-foreground">
                      {((summary?.investmentRate ?? 0.15) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-muted-foreground text-lg">×</div>
                  <div>
                    <p className="text-xs text-muted-foreground">Retorno Anual (I)</p>
                    <span className="text-sm font-bold font-money text-foreground">
                      {((summary?.annualReturnRate ?? 0.15) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-muted-foreground text-lg">=</div>
                  <div>
                    <p className="text-xs text-muted-foreground">Crescimento (CP)</p>
                    <MoneyDisplay value={fcp} size="lg" className="text-yellow-400" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Transactions */}
      {recentTxs && recentTxs.length > 0 && (
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">Transações Recentes (Open Finance)</CardTitle>
                <Badge variant="secondary" className="text-xs">{recentTxs.length} transações</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {recentTxs.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <CategoryBadge category={tx.category as any} size="sm" />
                      <span className="text-xs text-foreground truncate">{tx.description}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <MoneyDisplay
                        value={parseFloat(tx.amount)}
                        size="xs"
                        colorize
                        className={tx.type === "credit" ? "text-positive" : "text-negative"}
                      />
                      <span className="text-xs text-muted-foreground">
                        {new Date(tx.transactionDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
