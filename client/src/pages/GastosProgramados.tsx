import { useMonth } from "@/contexts/MonthContext";
import { trpc } from "@/lib/trpc";
import { MoneyDisplay, formatMoney } from "@/components/finance/MoneyDisplay";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Check, CreditCard, Banknote, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState, useMemo } from "react";

export default function GastosProgramados() {
  const { year, month, monthLabel } = useMonth();
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    description: "", amount: "", paymentType: "credit_card" as "credit_card" | "cash",
    creditCardId: "", scheduledDate: new Date(year, month - 1, 1).toISOString().split("T")[0],
  });

  const { data: expenses, isLoading } = trpc.planned.getExpenses.useQuery({ year, month });
  const { data: creditCards } = trpc.creditCards.getCards.useQuery();

  const create = trpc.planned.create.useMutation({
    onSuccess: () => {
      utils.planned.getExpenses.invalidate();
      utils.dashboard.getSummary.invalidate();
      setShowAdd(false);
      setForm({ description: "", amount: "", paymentType: "credit_card", creditCardId: "", scheduledDate: new Date(year, month - 1, 1).toISOString().split("T")[0] });
      toast.success("Gasto programado criado!");
    },
  });

  const del = trpc.planned.delete.useMutation({
    onSuccess: () => { utils.planned.getExpenses.invalidate(); toast.success("Removido"); },
  });

  const update = trpc.planned.update.useMutation({
    onSuccess: () => utils.planned.getExpenses.invalidate(),
  });

  const totals = useMemo(() => {
    const t = { credit_card: 0, cash: 0, total: 0 };
    (expenses ?? []).forEach((e) => {
      const amt = parseFloat(e.amount);
      t[e.paymentType] += amt;
      t.total += amt;
    });
    return t;
  }, [expenses]);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Gastos Pontuais Programados</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <MoneyDisplay value={totals.total} size="lg" className="text-orange-400" />
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Gasto
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-3.5 w-3.5 text-blue-400" />
              <p className="text-xs text-muted-foreground">Cartão de Crédito</p>
            </div>
            <MoneyDisplay value={totals.credit_card} size="sm" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-xs text-muted-foreground">Dinheiro / PIX</p>
            </div>
            <MoneyDisplay value={totals.cash} size="sm" />
          </CardContent>
        </Card>
      </div>

      {/* Expense List */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Lançamentos</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {!expenses || expenses.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum gasto programado para este mês</p>
            </div>
          ) : (
            <div className="space-y-1">
              {expenses.map((expense, idx) => {
                const card = creditCards?.find((c) => c.id === expense.creditCardId);
                return (
                  <motion.div
                    key={expense.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-secondary/40 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => update.mutate({ id: expense.id, isPaid: !expense.isPaid })}
                        className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
                          expense.isPaid ? "bg-positive border-positive" : "border-border hover:border-primary")}
                      >
                        {expense.isPaid && <Check className="h-3 w-3 text-background" />}
                      </button>
                      <div>
                        <p className={cn("text-sm font-medium", expense.isPaid && "line-through text-muted-foreground")}>{expense.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {new Date(expense.transactionDate).toLocaleDateString("pt-BR")}
                          </span>
                          {expense.paymentType === "credit_card" ? (
                            <Badge variant="secondary" className="text-xs h-4 px-1.5 gap-1">
                              <CreditCard className="h-2.5 w-2.5" />{card?.name ?? "Cartão"}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs h-4 px-1.5 gap-1">
                              <Banknote className="h-2.5 w-2.5" />Dinheiro
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <MoneyDisplay
                        value={parseFloat(expense.amount)} size="sm"
                        className={expense.isPaid ? "text-muted-foreground line-through" : "text-orange-400"}
                      />
                      <Button
                        size="icon" variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => del.mutate({ id: expense.id })}
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

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Novo Gasto Pontual Programado</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Descrição</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: IPVA, Matrícula escola..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Valor (R$)</label>
                <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" className="font-money" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Data prevista</label>
                <Input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Forma de pagamento</label>
              <Select value={form.paymentType} onValueChange={(v) => setForm({ ...form, paymentType: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                  <SelectItem value="cash">Dinheiro / PIX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.paymentType === "credit_card" && creditCards && creditCards.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Cartão</label>
                <Select value={form.creditCardId} onValueChange={(v) => setForm({ ...form, creditCardId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
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
                const [y, m, d] = form.scheduledDate.split("-").map(Number);
                create.mutate({
                  description: form.description, amount: amount.toFixed(2),
                  paymentType: form.paymentType,
                  creditCardId: form.creditCardId ? parseInt(form.creditCardId) : undefined,
                  year: y, month: m,
                  transactionDate: new Date(y, m - 1, d),
                  category: "outros" as const,
                });
              }}
              disabled={create.isPending}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
