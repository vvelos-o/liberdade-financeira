import { useMonth } from "@/contexts/MonthContext";
import { trpc } from "@/lib/trpc";
import { MoneyDisplay, formatMoney } from "@/components/finance/MoneyDisplay";
import { CategoryBadge, CATEGORY_COLORS, type FinanceCategory } from "@/components/finance/CategoryBadge";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Plus, Trash2, CreditCard, Banknote, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const QOL_CATEGORIES: FinanceCategory[] = ["lazer", "alimentacao", "transporte", "saude", "outros"];
const CATEGORY_LABELS: Record<string, string> = {
  lazer: "Lazer", alimentacao: "Alimentação", transporte: "Transporte", saude: "Saúde", outros: "Outros",
};

export default function QualidadeDeVida() {
  const { year, month, monthLabel } = useMonth();
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPayment, setFilterPayment] = useState<string>("all");

  type QolCategory = "lazer" | "alimentacao" | "transporte" | "saude" | "outros";
  const [form, setForm] = useState({
    description: "", amount: "", category: "lazer" as QolCategory,
    paymentType: "credit_card" as "credit_card" | "cash",
    creditCardId: undefined as number | undefined,
    transactionDate: new Date().toISOString().split("T")[0],
  });

  const { data: expenses, isLoading } = trpc.qol.getExpenses.useQuery({ year, month });
  const { data: creditCards } = trpc.creditCards.getCards.useQuery();

  const createExpense = trpc.qol.create.useMutation({
    onSuccess: () => {
      utils.qol.getExpenses.invalidate();
      utils.dashboard.getSummary.invalidate();
      setShowAdd(false);
      setForm({ description: "", amount: "", category: "lazer", paymentType: "credit_card", creditCardId: undefined, transactionDate: new Date().toISOString().split("T")[0] });
      toast.success("Gasto registrado!");
    },
    onError: () => toast.error("Erro ao registrar gasto"),
  });

  const deleteExpense = trpc.qol.delete.useMutation({
    onSuccess: () => { utils.qol.getExpenses.invalidate(); utils.dashboard.getSummary.invalidate(); toast.success("Gasto removido"); },
  });

  const filtered = useMemo(() => {
    return (expenses ?? []).filter((e) => {
      if (filterCategory !== "all" && e.category !== filterCategory) return false;
      if (filterPayment !== "all" && e.paymentType !== filterPayment) return false;
      return true;
    });
  }, [expenses, filterCategory, filterPayment]);

  const totals = useMemo(() => {
    const byCategory: Record<string, number> = {};
    const byPayment = { credit_card: 0, cash: 0 };
    (expenses ?? []).forEach((e) => {
      const amt = parseFloat(e.amount);
      byCategory[e.category] = (byCategory[e.category] ?? 0) + amt;
      byPayment[e.paymentType] += amt;
    });
    return { byCategory, byPayment, total: Object.values(byCategory).reduce((a, b) => a + b, 0) };
  }, [expenses]);

  const pieData = QOL_CATEGORIES.map((cat) => ({
    name: CATEGORY_LABELS[cat],
    value: totals.byCategory[cat] ?? 0,
    color: CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS],
  })).filter((d) => d.value > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-popover border border-border rounded-xl p-3 shadow-elevated">
          <p className="text-xs text-muted-foreground mb-1">{payload[0].name}</p>
          <p className="text-sm font-bold font-money">{formatMoney(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Qualidade de Vida</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Gasto
        </Button>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card border-border col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total QoL</p>
            <MoneyDisplay value={totals.total} size="xl" className="text-purple-400" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-3.5 w-3.5 text-blue-400" />
              <p className="text-xs text-muted-foreground">Cartão</p>
            </div>
            <MoneyDisplay value={totals.byPayment.credit_card} size="sm" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-xs text-muted-foreground">Dinheiro/PIX</p>
            </div>
            <MoneyDisplay value={totals.byPayment.cash} size="sm" />
          </CardContent>
        </Card>
        {/* Category summary */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Por categoria</p>
            <div className="space-y-1">
              {QOL_CATEGORIES.filter((c) => (totals.byCategory[c] ?? 0) > 0).slice(0, 3).map((cat) => (
                <div key={cat} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[cat]}</span>
                  <span className="text-xs font-money font-medium" style={{ color: CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS] }}>
                    {formatMoney(totals.byCategory[cat] ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts + List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Donut */}
        {pieData.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Distribuição</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="text-xs font-money font-medium text-foreground">{formatMoney(item.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expense List */}
        <Card className={cn("bg-card border-border", pieData.length > 0 ? "lg:col-span-2" : "lg:col-span-3")}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-semibold">Lançamentos</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="h-7 text-xs w-36">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {QOL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterPayment} onValueChange={setFilterPayment}>
                  <SelectTrigger className="h-7 text-xs w-32">
                    <SelectValue placeholder="Pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="credit_card">Cartão</SelectItem>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Nenhum lançamento encontrado</div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                {filtered.map((expense, idx) => {
                  const card = creditCards?.find((c) => c.id === expense.creditCardId);
                  return (
                    <motion.div
                      key={expense.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-secondary/40 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CategoryBadge category={expense.category as FinanceCategory} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{expense.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {new Date(expense.transactionDate).toLocaleDateString("pt-BR")}
                            </span>
                            {expense.paymentType === "credit_card" ? (
                              <Badge variant="secondary" className="text-xs h-4 px-1.5 gap-1">
                                <CreditCard className="h-2.5 w-2.5" />
                                {card?.name ?? "Cartão"}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs h-4 px-1.5 gap-1">
                                <Banknote className="h-2.5 w-2.5" />
                                Dinheiro
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <MoneyDisplay value={parseFloat(expense.amount)} size="sm" className="text-rose-400" />
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteExpense.mutate({ id: expense.id })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Novo Gasto — Qualidade de Vida</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Descrição</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Netflix, Supermercado..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Valor (R$)</label>
                <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" className="font-money" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Data</label>
                <Input type="date" value={form.transactionDate} onChange={(e) => setForm({ ...form, transactionDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Categoria</label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as QolCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QOL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Pagamento</label>
                <Select value={form.paymentType} onValueChange={(v) => setForm({ ...form, paymentType: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                    <SelectItem value="cash">Dinheiro / PIX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.paymentType === "credit_card" && creditCards && creditCards.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Cartão</label>
                <Select value={form.creditCardId?.toString() ?? ""} onValueChange={(v) => setForm({ ...form, creditCardId: parseInt(v) })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cartão" /></SelectTrigger>
                  <SelectContent>
                    {creditCards.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                const amount = parseFloat(form.amount.replace(",", "."));
                if (!form.description || isNaN(amount)) { toast.error("Preencha todos os campos"); return; }
                const [y, m, d] = form.transactionDate.split("-").map(Number);
                createExpense.mutate({
                  ...form, amount: amount.toFixed(2),
                  year: m <= month ? year : year,
                  month: m,
                  transactionDate: new Date(y, m - 1, d),
                });
              }}
              disabled={createExpense.isPending}
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
