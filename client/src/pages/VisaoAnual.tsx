import { useMonth } from "@/contexts/MonthContext";
import { trpc } from "@/lib/trpc";
import { MoneyDisplay, formatMoney } from "@/components/finance/MoneyDisplay";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const QOL_CATS = ["lazer", "alimentacao", "transporte", "saude", "outros"] as const;
type QolCat = typeof QOL_CATS[number];
const QOL_LABELS: Record<QolCat, string> = { lazer: "Lazer", alimentacao: "Alimentação", transporte: "Transporte", saude: "Saúde", outros: "OG" };
const QOL_COLORS: Record<QolCat, string> = { lazer: "#a78bfa", alimentacao: "#34d399", transporte: "#60a5fa", saude: "#f87171", outros: "#fbbf24" };

export default function VisaoAnual() {
  const { year, month } = useMonth();

  const { data: qolHistory, isLoading } = trpc.annual.getQolHistory.useQuery({ year });
  const { data: incomeHistory } = trpc.annual.getIncomeHistory.useQuery({ year });
  const { data: fixedHistory } = trpc.annual.getFixedHistory.useQuery({ year });

  // Build per-month aggregated data
  const monthlyData = useMemo(() => {
    return MONTH_NAMES.map((name, i) => {
      const m = i + 1;
      // QoL by category
      const qolRows = (qolHistory ?? []).filter((r) => r.month === m);
      const catTotals: Record<QolCat, number> = { lazer: 0, alimentacao: 0, transporte: 0, saude: 0, outros: 0 };
      qolRows.forEach((r) => { catTotals[r.category as QolCat] = parseFloat(r.total); });
      const qolTotal = Object.values(catTotals).reduce((a, b) => a + b, 0);

      // Income
      const incomeRows = (incomeHistory ?? []).filter((r) => r.month === m);
      const income = incomeRows.reduce((a, r) => a + parseFloat(r.amount), 0);

      // Fixed
      const fixedRows = (fixedHistory ?? []).filter((r) => r.month === m);
      const fixed = fixedRows.reduce((a, r) => a + parseFloat(r.amount), 0);

      return { name, m, ...catTotals, qolTotal, income, fixed, totalExpenses: qolTotal + fixed };
    });
  }, [qolHistory, incomeHistory, fixedHistory]);

  const annualTotals = useMemo(() => {
    const t: Record<QolCat | "income" | "fixed" | "qolTotal" | "totalExpenses", number> = {
      lazer: 0, alimentacao: 0, transporte: 0, saude: 0, outros: 0,
      income: 0, fixed: 0, qolTotal: 0, totalExpenses: 0,
    };
    monthlyData.forEach((m) => {
      QOL_CATS.forEach((cat) => { t[cat] += m[cat]; });
      t.income += m.income;
      t.fixed += m.fixed;
      t.qolTotal += m.qolTotal;
      t.totalExpenses += m.totalExpenses;
    });
    return t;
  }, [monthlyData]);

  const nonZeroMonths = monthlyData.filter((m) => m.totalExpenses > 0).length;
  const avgExpenses = nonZeroMonths > 0 ? annualTotals.totalExpenses / nonZeroMonths : 0;

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-popover border border-border rounded-xl p-3 shadow-xl min-w-[160px]">
          <p className="text-xs font-semibold text-foreground mb-2">{label}</p>
          {payload.map((p) => (
            <div key={p.name} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-xs text-muted-foreground">{p.name}</span>
              </div>
              <span className="text-xs font-mono font-medium text-foreground">{formatMoney(p.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Visão Anual</h1>
          <p className="text-sm text-muted-foreground">{year} — Histórico completo</p>
        </div>
        <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">{year}</Badge>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Receita Total", value: annualTotals.income, color: "text-positive" },
          { label: "Gastos Totais", value: annualTotals.totalExpenses, color: "text-rose-400" },
          { label: "Saldo Anual", value: annualTotals.income - annualTotals.totalExpenses, color: "text-blue-400" },
          { label: "Média Mensal Gastos", value: avgExpenses, color: "text-orange-400" },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
              {isLoading ? <Skeleton className="h-7 w-28" /> : <MoneyDisplay value={kpi.value} size="xl" className={kpi.color} />}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Income vs Expense Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Receita × Gastos — {year}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="income" name="Receita" fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={24} />
              <Bar dataKey="totalExpenses" name="Gastos" fill="#f87171" radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* QoL Stacked Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Qualidade de Vida por Categoria — {year}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barGap={1}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              {QOL_CATS.map((cat) => (
                <Bar key={cat} dataKey={cat} name={QOL_LABELS[cat]} stackId="qol" fill={QOL_COLORS[cat]} maxBarSize={28} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Annual Table — exact format: Mês | Lazer | Alimentação | Transporte | Saúde | OG | TOTAL */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Tabela Histórica de Gastos QoL — {year}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2.5 pr-4 text-muted-foreground font-semibold">Mês</th>
                {QOL_CATS.map((cat) => (
                  <th key={cat} className="text-right py-2.5 px-2 font-semibold" style={{ color: QOL_COLORS[cat] }}>
                    {QOL_LABELS[cat]}
                  </th>
                ))}
                <th className="text-right py-2.5 pl-3 text-foreground font-bold">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((row) => {
                const isCurrentMonth = row.m === month;
                return (
                  <tr
                    key={row.m}
                    className={cn(
                      "border-b border-border/30 hover:bg-secondary/30 transition-colors",
                      isCurrentMonth && "bg-primary/5 border-primary/20"
                    )}
                  >
                    <td className={cn("py-2.5 pr-4 font-medium", isCurrentMonth ? "text-primary" : "text-foreground")}>
                      {row.name}
                      {isCurrentMonth && <span className="ml-1.5 text-xs text-primary/60">(atual)</span>}
                    </td>
                    {QOL_CATS.map((cat) => {
                      const val = row[cat];
                      return (
                        <td key={cat} className={cn("text-right py-2.5 px-2 font-mono", val > 0 ? "text-foreground" : "text-muted-foreground/30")}>
                          {val > 0 ? formatMoney(val) : "—"}
                        </td>
                      );
                    })}
                    <td className={cn("text-right py-2.5 pl-3 font-mono font-bold", row.qolTotal > 0 ? "text-foreground" : "text-muted-foreground/30")}>
                      {row.qolTotal > 0 ? formatMoney(row.qolTotal) : "—"}
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr className="border-t-2 border-border bg-secondary/20">
                <td className="py-2.5 pr-4 font-bold text-foreground">TOTAL</td>
                {QOL_CATS.map((cat) => (
                  <td key={cat} className="text-right py-2.5 px-2 font-mono font-bold text-foreground">
                    {annualTotals[cat] > 0 ? formatMoney(annualTotals[cat]) : "—"}
                  </td>
                ))}
                <td className="text-right py-2.5 pl-3 font-mono font-bold text-foreground">
                  {annualTotals.qolTotal > 0 ? formatMoney(annualTotals.qolTotal) : "—"}
                </td>
              </tr>
              {/* Average row */}
              <tr className="bg-secondary/10">
                <td className="py-2 pr-4 text-muted-foreground font-medium">Média</td>
                {QOL_CATS.map((cat) => {
                  const avg = nonZeroMonths > 0 ? annualTotals[cat] / nonZeroMonths : 0;
                  return (
                    <td key={cat} className="text-right py-2 px-2 font-mono text-muted-foreground">
                      {avg > 0 ? formatMoney(avg) : "—"}
                    </td>
                  );
                })}
                <td className="text-right py-2 pl-3 font-mono text-muted-foreground font-medium">
                  {avgExpenses > 0 ? formatMoney(avgExpenses) : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
