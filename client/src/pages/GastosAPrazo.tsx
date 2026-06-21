import { useMonth } from "@/contexts/MonthContext";
import { trpc } from "@/lib/trpc";
import { MoneyDisplay, formatMoney } from "@/components/finance/MoneyDisplay";
import { CategoryBadge, type FinanceCategory } from "@/components/finance/CategoryBadge";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Check, CreditCard, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useState, useMemo } from "react";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const QOL_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "lazer", label: "Lazer" }, { value: "alimentacao", label: "Alimentação" },
  { value: "transporte", label: "Transporte" }, { value: "saude", label: "Saúde" }, { value: "outros", label: "Outros" },
];

export default function GastosAPrazo() {
  const { year, month, monthLabel } = useMonth();
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const [form, setForm] = useState({
    description: "", totalAmount: "", installmentAmount: "", totalInstallments: "12",
    startYear: year.toString(), startMonth: month.toString(),
    category: "outros", creditCardId: "",
  });

  const { data: installments } = trpc.installments.getAll.useQuery();
  const { data: monthInstallments } = trpc.installments.getMonthsForPeriod.useQuery({ year, month });
  const { data: creditCards } = trpc.creditCards.getCards.useQuery();

  const createInstallment = trpc.installments.create.useMutation({
    onSuccess: () => {
      utils.installments.getAll.invalidate();
      utils.installments.getMonthsForPeriod.invalidate();
      utils.dashboard.getSummary.invalidate();
      setShowAdd(false);
      setForm({ description: "", totalAmount: "", installmentAmount: "", totalInstallments: "12", startYear: year.toString(), startMonth: month.toString(), category: "outros", creditCardId: "" });
      toast.success("Parcelamento criado e propagado automaticamente!");
    },
    onError: () => toast.error("Erro ao criar parcelamento"),
  });

  const deleteInstallment = trpc.installments.delete.useMutation({
    onSuccess: () => { utils.installments.getAll.invalidate(); utils.installments.getMonthsForPeriod.invalidate(); toast.success("Parcelamento removido"); },
  });

  const markPaid = trpc.installments.markPaid.useMutation({
    onSuccess: () => utils.installments.getMonthsForPeriod.invalidate(),
  });

  const totalThisMonth = useMemo(() => (monthInstallments ?? []).reduce((a, b) => a + parseFloat(b.amount), 0), [monthInstallments]);

  // Map installment id to month data
  const monthMap = useMemo(() => {
    const map: Record<number, typeof monthInstallments extends undefined ? never : NonNullable<typeof monthInstallments>[0]> = {};
    monthInstallments?.forEach((m) => { map[m.installmentExpenseId] = m; });
    return map;
  }, [monthInstallments]);

  const handleAutoCalc = (field: "total" | "installment") => {
    const total = parseFloat(form.totalAmount.replace(",", "."));
    const n = parseInt(form.totalInstallments);
    const inst = parseFloat(form.installmentAmount.replace(",", "."));
    if (field === "total" && !isNaN(total) && !isNaN(n) && n > 0) {
      setForm({ ...form, installmentAmount: (total / n).toFixed(2) });
    } else if (field === "installment" && !isNaN(inst) && !isNaN(n) && n > 0) {
      setForm({ ...form, totalAmount: (inst * n).toFixed(2) });
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Gastos a Prazo</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Este mês</p>
            <MoneyDisplay value={totalThisMonth} size="lg" className="text-blue-400" />
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Parcelamento
          </Button>
        </div>
      </div>

      {/* This month's installments */}
      {monthInstallments && monthInstallments.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Parcelas de {MONTH_NAMES[month - 1]}/{year}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {monthInstallments.map((mi) => {
                const parent = installments?.find((i) => i.id === mi.installmentExpenseId);
                return (
                  <div key={mi.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => markPaid.mutate({ id: mi.id, isPaid: !mi.isPaid })}
                        className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-colors", mi.isPaid ? "bg-positive border-positive" : "border-border hover:border-primary")}
                      >
                        {mi.isPaid && <Check className="h-3 w-3 text-background" />}
                      </button>
                      <div>
                        <p className={cn("text-sm font-medium", mi.isPaid && "line-through text-muted-foreground")}>{parent?.description ?? "Parcelamento"}</p>
                        <p className="text-xs text-muted-foreground">Parcela {mi.installmentNumber} de {parent?.totalInstallments}</p>
                      </div>
                    </div>
                    <MoneyDisplay value={parseFloat(mi.amount)} size="sm" className={mi.isPaid ? "text-muted-foreground line-through" : "text-blue-400"} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All installments */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Todos os Parcelamentos Ativos</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {!installments || installments.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum parcelamento ativo</p>
            </div>
          ) : (
            <div className="space-y-2">
              {installments.map((inst) => {
                const progress = (inst.paidInstallments / inst.totalInstallments) * 100;
                const remaining = inst.totalInstallments - inst.paidInstallments;
                const card = creditCards?.find((c) => c.id === inst.creditCardId);
                const isExpanded = expanded === inst.id;

                return (
                  <motion.div key={inst.id} layout className="border border-border/60 rounded-xl overflow-hidden">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                      onClick={() => setExpanded(isExpanded ? null : inst.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CategoryBadge category={inst.category as FinanceCategory} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{inst.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{inst.paidInstallments}/{inst.totalInstallments} parcelas</span>
                            {card && (
                              <Badge variant="secondary" className="text-xs h-4 px-1.5 gap-1">
                                <CreditCard className="h-2.5 w-2.5" />{card.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <MoneyDisplay value={parseFloat(inst.installmentAmount)} size="sm" className="text-blue-400" />
                          <p className="text-xs text-muted-foreground">/mês × {remaining} restantes</p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); deleteInstallment.mutate({ id: inst.id }); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-border/40 pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground">Progresso</span>
                          <span className="text-xs font-medium text-foreground">{progress.toFixed(0)}%</span>
                        </div>
                        <Progress value={progress} className="h-1.5 mb-3" />
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground">Total</p>
                            <MoneyDisplay value={parseFloat(inst.totalAmount)} size="xs" />
                          </div>
                          <div>
                            <p className="text-muted-foreground">Por parcela</p>
                            <MoneyDisplay value={parseFloat(inst.installmentAmount)} size="xs" />
                          </div>
                          <div>
                            <p className="text-muted-foreground">Restante</p>
                            <MoneyDisplay value={parseFloat(inst.installmentAmount) * remaining} size="xs" className="text-rose-400" />
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle>Novo Gasto a Prazo</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Descrição</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: iPhone 16, Notebook..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Valor Total (R$)</label>
                <Input value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                  onBlur={() => handleAutoCalc("total")} placeholder="0,00" className="font-money" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Nº Parcelas</label>
                <Input value={form.totalInstallments} onChange={(e) => setForm({ ...form, totalInstallments: e.target.value })}
                  onBlur={() => handleAutoCalc("total")} placeholder="12" type="number" min="1" max="120" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Valor/Parcela</label>
                <Input value={form.installmentAmount} onChange={(e) => setForm({ ...form, installmentAmount: e.target.value })}
                  onBlur={() => handleAutoCalc("installment")} placeholder="0,00" className="font-money" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Início — Mês</label>
                <Select value={form.startMonth} onValueChange={(v) => setForm({ ...form, startMonth: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Início — Ano</label>
                <Input value={form.startYear} onChange={(e) => setForm({ ...form, startYear: e.target.value })} type="number" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Categoria</label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QOL_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {creditCards && creditCards.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Cartão (opcional)</label>
                  <Select value={form.creditCardId} onValueChange={(v) => setForm({ ...form, creditCardId: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {creditCards.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                const total = parseFloat(form.totalAmount.replace(",", "."));
                const inst = parseFloat(form.installmentAmount.replace(",", "."));
                const n = parseInt(form.totalInstallments);
                if (!form.description || isNaN(total) || isNaN(inst) || isNaN(n)) { toast.error("Preencha todos os campos"); return; }
                createInstallment.mutate({
                  description: form.description,
                  totalAmount: total.toFixed(2),
                  installmentAmount: inst.toFixed(2),
                  totalInstallments: n,
                  startYear: parseInt(form.startYear),
                  startMonth: parseInt(form.startMonth),
                  category: form.category as any,
                  creditCardId: form.creditCardId ? parseInt(form.creditCardId) : undefined,
                });
              }}
              disabled={createInstallment.isPending}
            >
              Criar e Propagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
