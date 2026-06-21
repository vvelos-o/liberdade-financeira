import { trpc } from "@/lib/trpc";
import { MoneyDisplay, formatMoney } from "@/components/finance/MoneyDisplay";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Plus, Target, Trophy, Calendar, Pencil, Trash2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";

export default function Metas() {
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [editGoal, setEditGoal] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "", targetAmount: "", currentAmount: "0",
    targetDate: "", period: "", notes: "",
  });

  const { data: goals } = trpc.goals.getAll.useQuery();

  const create = trpc.goals.create.useMutation({
    onSuccess: () => {
      utils.goals.getAll.invalidate();
      setShowAdd(false);
      resetForm();
      toast.success("Meta criada!");
    },
  });

  const update = trpc.goals.update.useMutation({
    onSuccess: () => { utils.goals.getAll.invalidate(); setEditGoal(null); resetForm(); toast.success("Meta atualizada!"); },
  });

  const del = trpc.goals.delete.useMutation({
    onSuccess: () => { utils.goals.getAll.invalidate(); toast.success("Meta removida"); },
  });

  const resetForm = () => setForm({ title: "", targetAmount: "", currentAmount: "0", targetDate: "", period: "", notes: "" });

  const handleSubmit = () => {
    const target = parseFloat(form.targetAmount.replace(",", "."));
    const current = parseFloat(form.currentAmount.replace(",", ".") || "0");
    if (!form.title || isNaN(target)) { toast.error("Preencha título e valor alvo"); return; }
    const payload = {
      title: form.title,
      targetAmount: target.toFixed(2),
      currentAmount: current.toFixed(2),
      targetDate: form.targetDate ? new Date(form.targetDate) : undefined,
      period: form.period || undefined,
      notes: form.notes || undefined,
    };
    if (editGoal) {
      update.mutate({ id: editGoal, ...payload });
    } else {
      create.mutate(payload);
    }
  };

  const openEdit = (goal: NonNullable<typeof goals>[0]) => {
    setForm({
      title: goal.title,
      targetAmount: parseFloat(goal.targetAmount).toFixed(2),
      currentAmount: parseFloat(goal.currentAmount ?? "0").toFixed(2),
      targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString().split("T")[0] : "",
      period: goal.period ?? "",
      notes: goal.notes ?? "",
    });
    setEditGoal(goal.id);
    setShowAdd(true);
  };

  const totalGoals = (goals ?? []).reduce((a, b) => a + parseFloat(b.targetAmount), 0);
  const totalSaved = (goals ?? []).reduce((a, b) => a + parseFloat(b.currentAmount ?? "0"), 0);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Metas Financeiras</h1>
          <p className="text-sm text-muted-foreground">Acompanhe seu progresso rumo à liberdade financeira</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setEditGoal(null); setShowAdd(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Meta
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total das Metas</p>
            <MoneyDisplay value={totalGoals} size="lg" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Já Acumulado</p>
            <MoneyDisplay value={totalSaved} size="lg" className="text-positive" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Progresso Geral</p>
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold font-money text-foreground">
                {totalGoals > 0 ? ((totalSaved / totalGoals) * 100).toFixed(0) : 0}%
              </span>
              <Progress value={totalGoals > 0 ? (totalSaved / totalGoals) * 100 : 0} className="flex-1 h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals Grid */}
      {!goals || goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Target className="h-14 w-14 mb-4 opacity-20" />
          <p className="text-base font-medium">Nenhuma meta definida</p>
          <p className="text-sm mt-1">Defina seus objetivos financeiros e acompanhe o progresso</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal, idx) => {
            const target = parseFloat(goal.targetAmount);
            const current = parseFloat(goal.currentAmount ?? "0");
            const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
            const remaining = target - current;
            const isAchieved = progress >= 100;
            const daysLeft = goal.targetDate ? Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
              >
                <Card className={cn("bg-card border-border overflow-hidden group", isAchieved && "border-positive/40")}>
                  {isAchieved && (
                    <div className="bg-positive/10 border-b border-positive/20 px-4 py-1.5 flex items-center gap-2">
                      <Trophy className="h-3.5 w-3.5 text-positive" />
                      <span className="text-xs font-medium text-positive">Meta atingida!</span>
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground truncate">{goal.title}</h3>
                        {goal.period && (
                          <Badge variant="secondary" className="text-xs mt-1">{goal.period}</Badge>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(goal)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => del.mutate({ id: goal.id })}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <MoneyDisplay value={current} size="sm" className="text-positive" />
                        <span className="text-xs text-muted-foreground">de {formatMoney(target)}</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">{progress.toFixed(0)}% concluído</span>
                        {!isAchieved && (
                          <span className="text-xs text-muted-foreground">Faltam {formatMoney(remaining)}</span>
                        )}
                      </div>
                    </div>

                    {/* Footer info */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {goal.targetDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(goal.targetDate).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</span>
                          {daysLeft !== null && daysLeft > 0 && !isAchieved && (
                            <span className={cn("ml-1", daysLeft < 30 ? "text-warning" : "")}>({daysLeft}d)</span>
                          )}
                        </div>
                      )}
                      {goal.notes && (
                        <p className="truncate text-muted-foreground/60">{goal.notes}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); if (!open) { setEditGoal(null); resetForm(); } }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{editGoal ? "Editar Meta" : "Nova Meta Financeira"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Título da meta</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Reserva de emergência, Viagem..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Valor Alvo (R$)</label>
                <Input value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} placeholder="0,00" className="font-money" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Já Acumulado (R$)</label>
                <Input value={form.currentAmount} onChange={(e) => setForm({ ...form, currentAmount: e.target.value })} placeholder="0,00" className="font-money" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Data alvo</label>
                <Input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Período (ex: 2025-2026)</label>
                <Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="Opcional" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Observações</label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Detalhes sobre a meta..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditGoal(null); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
              {editGoal ? "Salvar" : "Criar Meta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
