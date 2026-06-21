import { useMonth } from "@/contexts/MonthContext";
import { trpc } from "@/lib/trpc";
import { MoneyDisplay, formatMoney } from "@/components/finance/MoneyDisplay";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Info, Target, DollarSign, PiggyBank, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMemo } from "react";
import {
  RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis,
} from "recharts";

// FCP = (Receita - Gastos Totais) / Receita × 100
// Classificação:
// ≥ 30% = Excelente (verde)
// 15-29% = Bom (azul)
// 5-14% = Regular (amarelo)
// < 5% = Atenção (vermelho)

function getFcpClassification(fcp: number): { label: string; color: string; bgColor: string; description: string } {
  if (fcp >= 30) return { label: "Excelente", color: "text-positive", bgColor: "bg-positive/10", description: "Você está poupando mais de 30% da sua renda. Continue assim!" };
  if (fcp >= 15) return { label: "Bom", color: "text-blue-400", bgColor: "bg-blue-400/10", description: "Bom ritmo de poupança. Tente chegar a 30% para acelerar seu patrimônio." };
  if (fcp >= 5) return { label: "Regular", color: "text-warning", bgColor: "bg-warning/10", description: "Você está poupando pouco. Revise seus gastos para aumentar a taxa de poupança." };
  if (fcp >= 0) return { label: "Atenção", color: "text-rose-400", bgColor: "bg-rose-400/10", description: "Taxa de poupança muito baixa. Revise urgentemente seus gastos." };
  return { label: "Déficit", color: "text-destructive", bgColor: "bg-destructive/10", description: "Você está gastando mais do que ganha. Ação imediata necessária." };
}

export default function FCP() {
  const { year, month, monthLabel } = useMonth();

  const { data: summary } = trpc.dashboard.getSummary.useQuery({ year, month });

  const { fcp, income, totalExpenses, savings, classification } = useMemo(() => {
    const income = parseFloat(String(summary?.totalIncome ?? "0"));
    const totalExpenses = parseFloat(String(summary?.totalExpenses ?? "0"));
    const savings = income - totalExpenses;
    const fcp = income > 0 ? (savings / income) * 100 : 0;
    const classification = getFcpClassification(fcp);
    return { fcp, income, totalExpenses, savings, classification };
  }, [summary]);

  const chartData = [{ name: "FCP", value: Math.max(0, Math.min(fcp, 100)), fill: fcp >= 30 ? "#34d399" : fcp >= 15 ? "#60a5fa" : fcp >= 5 ? "#fbbf24" : "#f87171" }];

  const milestones = [
    { pct: 5, label: "Mínimo", description: "Poupança mínima recomendada" },
    { pct: 15, label: "Bom", description: "Boa taxa de poupança" },
    { pct: 20, label: "Regra 50/30/20", description: "Regra clássica de finanças pessoais" },
    { pct: 30, label: "Excelente", description: "Aceleração patrimonial" },
    { pct: 50, label: "FIRE", description: "Caminho para independência financeira" },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">FCP — Fator de Crescimento de Patrimônio</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <Info className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">FCP = (Receita − Gastos) ÷ Receita × 100. Representa a porcentagem da sua renda que está sendo poupada/investida no mês.</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Main FCP Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gauge */}
        <Card className="bg-card border-border lg:col-span-1">
          <CardContent className="p-6 flex flex-col items-center">
            <div className="relative w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="65%"
                  outerRadius="90%"
                  barSize={14}
                  data={chartData}
                  startAngle={225}
                  endAngle={-45}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar
                    background={{ fill: "hsl(var(--secondary))" }}
                    dataKey="value"
                    cornerRadius={8}
                    angleAxisId={0}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-3xl font-bold font-mono", classification.color)}>
                  {fcp.toFixed(1)}%
                </span>
                <Badge className={cn("text-xs mt-1 border-0", classification.bgColor, classification.color)}>
                  {classification.label}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2 max-w-[180px]">
              {classification.description}
            </p>
          </CardContent>
        </Card>

        {/* Breakdown */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Composição do Mês</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-positive" />
                  <span className="text-sm text-muted-foreground">Receita Total</span>
                </div>
                <MoneyDisplay value={income} size="sm" className="text-positive" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-400" />
                  <span className="text-sm text-muted-foreground">Gastos Totais</span>
                </div>
                <MoneyDisplay value={totalExpenses} size="sm" className="text-rose-400" />
              </div>
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {savings >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-positive" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-sm font-semibold text-foreground">Poupança / Saldo</span>
                </div>
                <MoneyDisplay value={savings} size="lg" className={savings >= 0 ? "text-positive" : "text-destructive"} />
              </div>
            </div>

            {/* Visual bar */}
            {income > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Gastos ({((totalExpenses / income) * 100).toFixed(0)}%)</span>
                  <span>Poupança ({fcp.toFixed(0)}%)</span>
                </div>
                <div className="h-3 rounded-full bg-secondary overflow-hidden flex">
                  <motion.div
                    className="h-full bg-rose-400 rounded-l-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((totalExpenses / income) * 100, 100)}%` }}
                    transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                  />
                  <motion.div
                    className="h-full bg-positive rounded-r-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, Math.min(fcp, 100))}%` }}
                    transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Milestones */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Marcos de Poupança</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {milestones.map((m) => {
              const achieved = fcp >= m.pct;
              const isCurrent = milestones.findIndex((ms) => fcp < ms.pct) === milestones.indexOf(m);
              return (
                <div key={m.pct} className={cn("flex items-center gap-3 py-2 px-3 rounded-lg transition-colors", achieved ? "bg-positive/5" : "bg-secondary/20", isCurrent && "ring-1 ring-primary/30")}>
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold", achieved ? "bg-positive text-background" : "bg-secondary text-muted-foreground")}>
                    {achieved ? "✓" : `${m.pct}%`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn("text-sm font-medium", achieved ? "text-foreground" : "text-muted-foreground")}>{m.label}</p>
                      <span className={cn("text-xs", achieved ? "text-positive" : "text-muted-foreground/60")}>{m.pct}%</span>
                      {isCurrent && <Badge variant="secondary" className="text-xs h-4 px-1.5">Próximo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                    {!achieved && (
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        Faltam {formatMoney(income * (m.pct / 100) - savings)} para atingir
                      </p>
                    )}
                  </div>
                  <Progress value={achieved ? 100 : income > 0 ? Math.min((fcp / m.pct) * 100, 100) : 0} className="w-20 h-1.5" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Dicas para melhorar seu FCP</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: DollarSign, title: "Regra 50/30/20", desc: "50% necessidades, 30% desejos, 20% poupança. Uma base sólida para começar." },
              { icon: Target, title: "Automatize a poupança", desc: "Configure transferência automática no dia do salário. Pague-se primeiro." },
              { icon: PiggyBank, title: "Revise gastos fixos", desc: "Gastos fixos são os mais impactantes. Renegocie planos, seguros e assinaturas." },
            ].map((tip) => {
              const Icon = tip.icon;
              return (
                <div key={tip.title} className="p-3 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold text-foreground">{tip.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{tip.desc}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
