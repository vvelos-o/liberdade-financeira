import { useMonth } from "@/contexts/MonthContext";
import { trpc } from "@/lib/trpc";
import { MoneyDisplay, formatMoney } from "@/components/finance/MoneyDisplay";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Check, X, Home } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState, useMemo } from "react";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function GastosFixos() {
  const { year, month, monthLabel } = useMonth();
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingEntry, setEditingEntry] = useState<{ categoryId: number; value: string } | null>(null);

  const { data: categories } = trpc.fixedExpenses.getCategories.useQuery();
  const { data: entries } = trpc.fixedExpenses.getEntries.useQuery({ year, month });
  const { data: yearEntries } = trpc.fixedExpenses.getEntriesForYear.useQuery({ year });

  const createCategory = trpc.fixedExpenses.createCategory.useMutation({
    onSuccess: () => { utils.fixedExpenses.getCategories.invalidate(); setShowAdd(false); setNewName(""); toast.success("Categoria criada!"); },
  });

  const updateCategory = trpc.fixedExpenses.updateCategory.useMutation({
    onSuccess: () => utils.fixedExpenses.getCategories.invalidate(),
  });

  const upsertEntry = trpc.fixedExpenses.upsertEntry.useMutation({
    onSuccess: () => {
      utils.fixedExpenses.getEntries.invalidate();
      utils.dashboard.getSummary.invalidate();
      setEditingEntry(null);
      toast.success("Valor atualizado!");
    },
  });

  const entryMap = useMemo(() => {
    const map: Record<number, number> = {};
    entries?.forEach((e) => { map[e.categoryId] = parseFloat(e.amount); });
    return map;
  }, [entries]);

  const yearEntryMap = useMemo(() => {
    const map: Record<string, number> = {};
    yearEntries?.forEach((e) => { map[`${e.categoryId}-${e.month}`] = parseFloat(e.amount); });
    return map;
  }, [yearEntries]);

  const totalFixed = useMemo(() => Object.values(entryMap).reduce((a, b) => a + b, 0), [entryMap]);

  const handleSave = (categoryId: number) => {
    if (!editingEntry || editingEntry.categoryId !== categoryId) return;
    const amount = parseFloat(editingEntry.value.replace(",", "."));
    if (isNaN(amount)) { toast.error("Valor inválido"); return; }
    upsertEntry.mutate({ categoryId, year, month, amount: amount.toFixed(2) });
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Gastos Fixos</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <MoneyDisplay value={totalFixed} size="lg" className="text-rose-400" />
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Categoria
          </Button>
        </div>
      </div>

      {/* Categories Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {categories?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Home className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Nenhuma categoria criada</p>
              <p className="text-xs mt-1">Clique em "Nova Categoria" para começar</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {categories?.map((cat, idx) => {
                const currentValue = entryMap[cat.id] ?? 0;
                const isEditing = editingEntry?.categoryId === cat.id;
                return (
                  <motion.div
                    key={cat.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="flex items-center justify-between px-5 py-3 group hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 rounded-full bg-yellow-400/60" />
                      <span className="text-sm text-foreground font-medium">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Input
                            value={editingEntry.value}
                            onChange={(e) => setEditingEntry({ ...editingEntry, value: e.target.value })}
                            className="h-7 w-32 text-right text-sm font-money"
                            placeholder="0,00"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") handleSave(cat.id); if (e.key === "Escape") setEditingEntry(null); }}
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-positive" onClick={() => handleSave(cat.id)}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingEntry(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingEntry({ categoryId: cat.id, value: currentValue > 0 ? currentValue.toFixed(2) : "" })}
                            className={cn("font-money text-sm font-semibold px-2 py-1 rounded hover:bg-secondary transition-colors", currentValue > 0 ? "text-rose-400" : "text-muted-foreground")}
                          >
                            {currentValue > 0 ? formatMoney(currentValue) : "Inserir valor"}
                          </button>
                          <Button
                            size="icon" variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => updateCategory.mutate({ id: cat.id, isActive: false })}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              {/* Total row */}
              <div className="flex items-center justify-between px-5 py-3 bg-secondary/20">
                <span className="text-sm font-bold text-foreground">TOTAL</span>
                <MoneyDisplay value={totalFixed} size="sm" className="text-rose-400 font-bold" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Annual History */}
      {categories && categories.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Histórico Anual — {year}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Categoria</th>
                  {MONTH_NAMES.map((m, i) => (
                    <th key={m} className={cn("text-right py-2 px-1 text-muted-foreground font-medium", i + 1 === month && "text-primary")}>{m}</th>
                  ))}
                  <th className="text-right py-2 pl-2 text-muted-foreground font-medium">Média</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => {
                  const monthlyValues = Array.from({ length: 12 }, (_, i) => yearEntryMap[`${cat.id}-${i + 1}`] ?? 0);
                  const nonZero = monthlyValues.filter((v) => v > 0);
                  const avg = nonZero.length > 0 ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
                  return (
                    <tr key={cat.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                      <td className="py-2 pr-4 text-foreground font-medium truncate max-w-[120px]">{cat.name}</td>
                      {monthlyValues.map((val, i) => (
                        <td key={i} className={cn("text-right py-2 px-1 font-money", val > 0 ? "text-rose-400" : "text-muted-foreground/30", i + 1 === month && "font-bold")}>
                          {val > 0 ? `${(val / 1000).toFixed(1)}k` : "—"}
                        </td>
                      ))}
                      <td className="text-right py-2 pl-2 font-money font-bold text-muted-foreground">
                        {avg > 0 ? `${(avg / 1000).toFixed(1)}k` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Nova Categoria de Gasto Fixo</DialogTitle></DialogHeader>
          <div className="py-2">
            <label className="text-xs text-muted-foreground mb-1.5 block">Nome</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Aluguel, Internet, Plano de saúde..."
              onKeyDown={(e) => e.key === "Enter" && createCategory.mutate({ name: newName })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={() => createCategory.mutate({ name: newName })} disabled={!newName.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
