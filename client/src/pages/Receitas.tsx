import { useMonth } from "@/contexts/MonthContext";
import { trpc } from "@/lib/trpc";
import { MoneyDisplay, formatMoney } from "@/components/finance/MoneyDisplay";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, DollarSign, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useState, useMemo } from "react";

const TYPE_CONFIG = {
  fixed: { label: "Renda Fixa", color: "text-emerald-400", bg: "bg-emerald-400/10", icon: DollarSign },
  variable: { label: "Renda Variável", color: "text-blue-400", bg: "bg-blue-400/10", icon: TrendingUp },
  extra: { label: "Renda Extra", color: "text-orange-400", bg: "bg-orange-400/10", icon: TrendingDown },
};

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function Receitas() {
  const { year, month, monthLabel } = useMonth();
  const utils = trpc.useUtils();
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceType, setNewSourceType] = useState<"fixed" | "variable" | "extra">("fixed");
  const [editingEntry, setEditingEntry] = useState<{ sourceId: number; value: string } | null>(null);

  const { data: sources, isLoading: loadingSources } = trpc.income.getSources.useQuery();
  const { data: entries, isLoading: loadingEntries } = trpc.income.getEntries.useQuery({ year, month });
  const { data: yearEntries } = trpc.income.getEntriesForYear.useQuery({ year });

  const createSource = trpc.income.createSource.useMutation({
    onSuccess: () => {
      utils.income.getSources.invalidate();
      setShowAddSource(false);
      setNewSourceName("");
      toast.success("Fonte de renda criada!");
    },
    onError: () => toast.error("Erro ao criar fonte de renda"),
  });

  const deleteSource = trpc.income.deleteSource.useMutation({
    onSuccess: () => { utils.income.getSources.invalidate(); toast.success("Fonte removida"); },
  });

  const upsertEntry = trpc.income.upsertEntry.useMutation({
    onSuccess: () => {
      utils.income.getEntries.invalidate();
      utils.dashboard.getSummary.invalidate();
      setEditingEntry(null);
      toast.success("Valor atualizado!");
    },
    onError: () => toast.error("Erro ao salvar valor"),
  });

  const entryMap = useMemo(() => {
    const map: Record<number, number> = {};
    entries?.forEach((e) => { map[e.sourceId] = parseFloat(e.amount); });
    return map;
  }, [entries]);

  const yearEntryMap = useMemo(() => {
    const map: Record<string, number> = {};
    yearEntries?.forEach((e) => { map[`${e.sourceId}-${e.month}`] = parseFloat(e.amount); });
    return map;
  }, [yearEntries]);

  const totalByType = useMemo(() => {
    const totals: Record<string, number> = { fixed: 0, variable: 0, extra: 0 };
    sources?.forEach((s) => { totals[s.type] = (totals[s.type] ?? 0) + (entryMap[s.id] ?? 0); });
    return totals;
  }, [sources, entryMap]);

  const totalIncome = Object.values(totalByType).reduce((a, b) => a + b, 0);

  const handleSaveEntry = (sourceId: number) => {
    if (!editingEntry || editingEntry.sourceId !== sourceId) return;
    const amount = parseFloat(editingEntry.value.replace(",", "."));
    if (isNaN(amount)) { toast.error("Valor inválido"); return; }
    upsertEntry.mutate({ sourceId, year, month, amount: amount.toFixed(2) });
  };

  const groupedSources = useMemo(() => {
    const groups: Record<string, typeof sources> = { fixed: [], variable: [], extra: [] };
    sources?.forEach((s) => { groups[s.type]?.push(s); });
    return groups;
  }, [sources]);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Receitas</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <Button size="sm" onClick={() => setShowAddSource(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Fonte
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card border-border col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total do Mês</p>
            <MoneyDisplay value={totalIncome} size="xl" className="text-positive" />
          </CardContent>
        </Card>
        {(["fixed", "variable", "extra"] as const).map((type) => {
          const config = TYPE_CONFIG[type];
          const Icon = config.icon;
          return (
            <Card key={type} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn("p-1 rounded", config.bg)}>
                    <Icon className={cn("h-3 w-3", config.color)} />
                  </div>
                  <p className="text-xs text-muted-foreground">{config.label}</p>
                </div>
                <MoneyDisplay value={totalByType[type] ?? 0} size="sm" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Income Sources by Type */}
      {(["fixed", "variable", "extra"] as const).map((type) => {
        const config = TYPE_CONFIG[type];
        const typeSources = groupedSources[type] ?? [];
        if (typeSources.length === 0) return null;

        return (
          <motion.div
            key={type}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-xs", config.color, config.bg, "border-0")}>{config.label}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Total: <MoneyDisplay value={totalByType[type] ?? 0} size="xs" />
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {typeSources.map((source) => {
                    const currentValue = entryMap[source.id] ?? 0;
                    const isEditing = editingEntry?.sourceId === source.id;

                    return (
                      <div key={source.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 group">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm text-foreground truncate">{source.name}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isEditing ? (
                            <>
                              <Input
                                value={editingEntry.value}
                                onChange={(e) => setEditingEntry({ ...editingEntry, value: e.target.value })}
                                className="h-7 w-32 text-right text-sm font-money"
                                placeholder="0,00"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEntry(source.id);
                                  if (e.key === "Escape") setEditingEntry(null);
                                }}
                              />
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-positive" onClick={() => handleSaveEntry(source.id)}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingEntry(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setEditingEntry({ sourceId: source.id, value: currentValue > 0 ? currentValue.toFixed(2) : "" })}
                                className={cn(
                                  "font-money text-sm font-semibold px-2 py-1 rounded hover:bg-secondary transition-colors",
                                  currentValue > 0 ? "text-positive" : "text-muted-foreground"
                                )}
                              >
                                {currentValue > 0 ? formatMoney(currentValue) : "Clique para inserir"}
                              </button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => deleteSource.mutate({ id: source.id })}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}

      {/* Annual View */}
      {sources && sources.length > 0 && yearEntries && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Histórico Anual — {year}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Fonte</th>
                  {MONTH_NAMES.map((m) => (
                    <th key={m} className={cn("text-right py-2 px-1 text-muted-foreground font-medium", MONTH_NAMES.indexOf(m) + 1 === month && "text-primary")}>{m}</th>
                  ))}
                  <th className="text-right py-2 pl-2 text-muted-foreground font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => {
                  const yearTotal = Array.from({ length: 12 }, (_, i) => yearEntryMap[`${source.id}-${i + 1}`] ?? 0).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={source.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                      <td className="py-2 pr-4 text-foreground font-medium truncate max-w-[120px]">{source.name}</td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const val = yearEntryMap[`${source.id}-${i + 1}`] ?? 0;
                        return (
                          <td key={i} className={cn("text-right py-2 px-1 font-money", val > 0 ? "text-positive" : "text-muted-foreground/40", i + 1 === month && "font-bold")}>
                            {val > 0 ? `${(val / 1000).toFixed(1)}k` : "—"}
                          </td>
                        );
                      })}
                      <td className="text-right py-2 pl-2 font-money font-bold text-foreground">
                        {yearTotal > 0 ? `${(yearTotal / 1000).toFixed(1)}k` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Add Source Dialog */}
      <Dialog open={showAddSource} onOpenChange={setShowAddSource}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Nova Fonte de Renda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Nome da fonte</label>
              <Input
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                placeholder="Ex: Salário CLT, Freelance..."
                onKeyDown={(e) => e.key === "Enter" && createSource.mutate({ name: newSourceName, type: newSourceType })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Tipo</label>
              <Select value={newSourceType} onValueChange={(v) => setNewSourceType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Renda Fixa</SelectItem>
                  <SelectItem value="variable">Renda Variável</SelectItem>
                  <SelectItem value="extra">Renda Extra</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSource(false)}>Cancelar</Button>
            <Button
              onClick={() => createSource.mutate({ name: newSourceName, type: newSourceType })}
              disabled={!newSourceName.trim() || createSource.isPending}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
