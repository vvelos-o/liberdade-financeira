import { trpc } from "@/lib/trpc";
import { useMonth } from "@/contexts/MonthContext";
import { formatMoney } from "@/components/finance/MoneyDisplay";
import { CATEGORY_LABELS, VARIABLE_CATEGORIES, CATEGORY_COLORS } from "@/components/finance/CategoryBadge";
import { DEFAULT_CATEGORY_PERCENTAGES } from "@shared/categories";
import { cn } from "@/lib/utils";
import {
  DollarSign, Home, Target, Percent, Link2, Plus, Trash2, Save, Edit2, Check, X, CreditCard, Copy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { toast } from "sonner";

// ─── Income Section ──────────────────────────────────────────────────────────

function IncomeSection() {
  const { year, month } = useMonth();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const { data: sources, isLoading: loadingSources } = trpc.income.getSources.useQuery();
  const { data: entries, isLoading: loadingEntries } = trpc.income.getEntries.useQuery({ year, month });
  const { data: prevEntries } = trpc.income.getEntries.useQuery({ year: prevYear, month: prevMonth });
  const createMutation = trpc.income.createSource.useMutation();
  const upsertEntryMutation = trpc.income.upsertEntry.useMutation();
  const deleteMutation = trpc.income.deleteSource.useMutation();
  const deleteEntryMutation = trpc.income.deleteEntry.useMutation();
  const utils = trpc.useUtils();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"fixed" | "variable">("fixed");
  const [newAmount, setNewAmount] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [copying, setCopying] = useState(false);

  // Show copy button if previous month has entries that current month is missing
  const currentSourceIds = new Set((entries ?? []).map((e: any) => e.sourceId));
  const missingFromPrev = (prevEntries ?? []).filter((e: any) => !currentSourceIds.has(e.sourceId));
  const showCopyButton = missingFromPrev.length > 0;

  const handleCopyPrevious = async () => {
    if (!missingFromPrev.length || !sources) return;
    setCopying(true);
    try {
      for (const entry of missingFromPrev) {
        // Only copy if source is still active
        const source = sources.find((s: any) => s.id === entry.sourceId && s.isActive);
        if (source) {
          await upsertEntryMutation.mutateAsync({
            sourceId: entry.sourceId,
            year,
            month,
            amount: entry.amount,
          });
        }
      }
      utils.income.getEntries.invalidate();
      utils.dashboard.getFunnel.invalidate();
      toast.success("Valores copiados. Clique em qualquer valor para editar.");
    } catch {
      toast.error("Erro ao copiar valores.");
    } finally {
      setCopying(false);
    }
  };

  const getEntryAmount = (sourceId: number) => {
    const entry = entries?.find((e: any) => e.sourceId === sourceId);
    return entry ? parseFloat(entry.amount) : 0;
  };

  const totalIncome = sources?.reduce((sum: number, s: any) => sum + getEntryAmount(s.id), 0) ?? 0;

  const handleAdd = () => {
    if (!newName) return;
    createMutation.mutate({ name: newName, type: newType }, {
      onSuccess: (created: any) => {
        if (newAmount && created?.id) {
          upsertEntryMutation.mutate({ sourceId: created.id, year, month, amount: newAmount }, {
            onSuccess: () => {
              utils.income.getSources.invalidate();
              utils.income.getEntries.invalidate();
              utils.dashboard.getFunnel.invalidate();
            },
          });
        } else {
          utils.income.getSources.invalidate();
        }
        setShowAdd(false);
        setNewName("");
        setNewAmount("");
        toast.success("Renda adicionada.");
      },
    });
  };

  const handleSaveAmount = (sourceId: number) => {
    upsertEntryMutation.mutate({ sourceId, year, month, amount: editAmount }, {
      onSuccess: () => {
        utils.income.getEntries.invalidate();
        utils.dashboard.getFunnel.invalidate();
        setEditingId(null);
        toast.success("Valor atualizado.");
      },
    });
  };

  const isLoading = loadingSources || loadingEntries;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-positive" />
            Rendas
          </span>
          <span className="font-money text-xs text-positive">{formatMoney(totalIncome)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {isLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <>
            {sources?.filter((s: any) => s.isActive && entries?.some((e: any) => e.sourceId === s.id)).map((src: any) => {
            const amount = getEntryAmount(src.id);
              return (
                <div key={src.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-foreground truncate">{src.name}</span>
                    <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                      {src.type === "fixed" ? "Fixa" : src.type === "variable" ? "Variável" : "Extra"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {editingId === src.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="h-7 w-24 text-sm text-right"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && handleSaveAmount(src.id)}
                        />
                        <button onClick={() => handleSaveAmount(src.id)} className="text-positive p-1">
                          <Check className="h-3 w-3" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-muted-foreground p-1">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditingId(src.id); setEditAmount(amount.toString()); }}
                          className="font-money text-sm text-positive hover:underline cursor-pointer"
                        >
                          {formatMoney(amount)}
                        </button>
                        <button
                          onClick={() => deleteEntryMutation.mutate({ sourceId: src.id, year, month }, { onSuccess: () => { utils.income.getEntries.invalidate(); utils.dashboard.getFunnel.invalidate(); } })}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {showCopyButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyPrevious}
                disabled={copying}
                className="w-full h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
              >
                <Copy className="h-3 w-3 mr-1" />
                {copying ? "Copiando..." : "Copiar valores do mês anterior"}
              </Button>
            )}
            {showAdd ? (
              <div className="space-y-2 pt-2 border-t border-border">
                <Input placeholder="Descrição (ex: Salário CLT)" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-sm" />
                <div className="flex gap-2">
                  <Input placeholder="Valor mensal" type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} className="h-8 text-sm flex-1" />
                  <select value={newType} onChange={(e) => setNewType(e.target.value as any)} className="h-8 text-xs rounded-md border border-border bg-background px-2">
                    <option value="fixed">Fixa</option>
                    <option value="variable">Variável</option>
                    <option value="extra">Extra</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd} disabled={createMutation.isPending} className="h-7 text-xs">
                    <Check className="h-3 w-3 mr-1" />Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="h-7 text-xs">
                    <X className="h-3 w-3 mr-1" />Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)} className="w-full h-8 text-xs text-muted-foreground">
                <Plus className="h-3 w-3 mr-1" />Adicionar renda
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Fixed Expenses Section ──────────────────────────────────────────────────

function FixedExpensesSection() {
  const { year, month } = useMonth();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const { data: categories, isLoading: loadingCats } = trpc.fixedExpenses.getCategories.useQuery();
  const { data: entries, isLoading: loadingEntries } = trpc.fixedExpenses.getEntries.useQuery({ year, month });
  const { data: prevEntries } = trpc.fixedExpenses.getEntries.useQuery({ year: prevYear, month: prevMonth });
  const createMutation = trpc.fixedExpenses.createCategory.useMutation();
  const upsertEntryMutation = trpc.fixedExpenses.upsertEntry.useMutation();
  const updateCatMutation = trpc.fixedExpenses.updateCategory.useMutation();
  const utils = trpc.useUtils();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [copying, setCopying] = useState(false);

  // Show copy button if previous month has entries that current month is missing
  const currentCatIds = new Set((entries ?? []).map((e: any) => e.categoryId));
  const missingFromPrev = (prevEntries ?? []).filter((e: any) => !currentCatIds.has(e.categoryId));
  const showCopyButton = missingFromPrev.length > 0;

  const handleCopyPrevious = async () => {
    if (!missingFromPrev.length || !categories) return;
    setCopying(true);
    try {
      for (const entry of missingFromPrev) {
        // Only copy if category is still active
        const cat = categories.find((c: any) => c.id === entry.categoryId && c.isActive);
        if (cat) {
          await upsertEntryMutation.mutateAsync({
            categoryId: entry.categoryId,
            year,
            month,
            amount: entry.amount,
          });
        }
      }
      utils.fixedExpenses.getEntries.invalidate();
      utils.dashboard.getFunnel.invalidate();
      toast.success("Valores copiados. Clique em qualquer valor para editar.");
    } catch {
      toast.error("Erro ao copiar valores.");
    } finally {
      setCopying(false);
    }
  };

  const getEntryAmount = (catId: number) => {
    const entry = entries?.find((e: any) => e.categoryId === catId);
    return entry ? parseFloat(entry.amount) : 0;
  };

  const total = categories?.filter((c: any) => c.isActive).reduce((sum: number, c: any) => sum + getEntryAmount(c.id), 0) ?? 0;

  const handleAdd = () => {
    if (!newName) return;
    createMutation.mutate({ name: newName }, {
      onSuccess: (created: any) => {
          if (created?.id) {
            upsertEntryMutation.mutate({ sourceId: created.id, year, month, amount: newAmount || "0" }, {
            onSuccess: () => {
              utils.fixedExpenses.getCategories.invalidate();
              utils.fixedExpenses.getEntries.invalidate();
              utils.dashboard.getFunnel.invalidate();
            },
          });
        } else {
          utils.fixedExpenses.getCategories.invalidate();
        }
        setShowAdd(false);
        setNewName("");
        setNewAmount("");
        toast.success("Gasto fixo adicionado.");
      },
    });
  };

  const handleSaveAmount = (catId: number) => {
    upsertEntryMutation.mutate({ categoryId: catId, year, month, amount: editAmount }, {
      onSuccess: () => {
        utils.fixedExpenses.getEntries.invalidate();
        utils.dashboard.getFunnel.invalidate();
        setEditingId(null);
        toast.success("Valor atualizado.");
      },
    });
  };

  const isLoading = loadingCats || loadingEntries;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Home className="h-4 w-4 text-yellow-400" />
            Gastos Fixos
          </span>
          <span className="font-money text-xs text-muted-foreground">Total: {formatMoney(total)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {isLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <>
            {categories?.filter((c: any) => c.isActive).map((cat: any) => {
              const amount = getEntryAmount(cat.id);
              return (
                <div key={cat.id} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-foreground truncate">{cat.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {editingId === cat.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="h-7 w-24 text-sm text-right"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && handleSaveAmount(cat.id)}
                        />
                        <button onClick={() => handleSaveAmount(cat.id)} className="text-positive p-1">
                          <Check className="h-3 w-3" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-muted-foreground p-1">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditingId(cat.id); setEditAmount(amount.toString()); }}
                          className="font-money text-sm text-muted-foreground hover:underline cursor-pointer"
                        >
                          {formatMoney(amount)}
                        </button>
                        <button
                          onClick={() => updateCatMutation.mutate({ id: cat.id, isActive: false }, { onSuccess: () => { utils.fixedExpenses.getCategories.invalidate(); utils.fixedExpenses.getEntries.invalidate(); utils.dashboard.getFunnel.invalidate(); } })}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {showCopyButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyPrevious}
                disabled={copying}
                className="w-full h-8 text-xs border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10"
              >
                <Copy className="h-3 w-3 mr-1" />
                {copying ? "Copiando..." : "Copiar valores do mês anterior"}
              </Button>
            )}
            {showAdd ? (
              <div className="space-y-2 pt-2 border-t border-border">
                <Input placeholder="Descrição (ex: Aluguel, Terapia)" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Valor mensal" type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} className="h-8 text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd} disabled={createMutation.isPending} className="h-7 text-xs">
                    <Check className="h-3 w-3 mr-1" />Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="h-7 text-xs">
                    <X className="h-3 w-3 mr-1" />Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)} className="w-full h-8 text-xs text-muted-foreground">
                <Plus className="h-3 w-3 mr-1" />Adicionar gasto fixo
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Category Percentages Section ────────────────────────────────────────────

function CategoryPercentagesSection() {
  const { year, month } = useMonth();
  const { data: settings, isLoading } = trpc.budget.get.useQuery({ year, month });
  const updateMutation = trpc.budget.upsert.useMutation();
  const utils = trpc.useUtils();

  const [percentages, setPercentages] = useState<Record<string, number>>({});
  const [investmentTarget, setInvestmentTarget] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (settings) {
      const parsed = settings.categoryPercentages
        ? (typeof settings.categoryPercentages === "string" ? JSON.parse(settings.categoryPercentages) : settings.categoryPercentages)
        : { ...DEFAULT_CATEGORY_PERCENTAGES };
      setPercentages(parsed);
      setInvestmentTarget(settings.investmentTarget ?? "0");
    } else {
      // Default values when no settings exist yet
      setPercentages({ ...DEFAULT_CATEGORY_PERCENTAGES });
      setInvestmentTarget("0");
    }
  }, [settings]);

  const total = Object.values(percentages).reduce((s, v) => s + v, 0);

  const handleSave = () => {
    if (total !== 100) {
      toast.error("Os percentuais devem somar 100%.");
      return;
    }
    updateMutation.mutate({
      year,
      month,
      investmentTarget,
      categoryPercentages: percentages,
    }, {
      onSuccess: () => {
        utils.budget.get.invalidate();
        utils.dashboard.getFunnel.invalidate();
        setEditing(false);
        toast.success("Orçamento atualizado.");
      },
    });
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-primary" />
            Orçamento por Categoria
          </span>
          {!editing && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="h-6 text-xs">
              <Edit2 className="h-3 w-3 mr-1" />Editar
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Investment Target */}
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <span className="text-sm text-foreground">Meta de investimento</span>
          {editing ? (
            <Input
              type="number"
              value={investmentTarget}
              onChange={(e) => setInvestmentTarget(e.target.value)}
              className="h-7 w-28 text-sm text-right"
            />
          ) : (
            <span className="font-money text-sm text-primary">{formatMoney(parseFloat(investmentTarget || "0"))}/mês</span>
          )}
        </div>

        {/* Category percentages with sliders */}
        {VARIABLE_CATEGORIES.map((cat) => (
          <div key={cat} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                <span className="text-sm text-foreground">{CATEGORY_LABELS[cat]}</span>
              </div>
              <span className={cn("font-money text-sm font-medium", editing ? "text-foreground" : "text-muted-foreground")}>
                {percentages[cat] ?? 0}%
              </span>
            </div>
            {editing && (
              <Slider
                value={[percentages[cat] ?? 0]}
                onValueChange={([val]) => setPercentages({ ...percentages, [cat]: val })}
                min={0}
                max={60}
                step={1}
                className="[&_[data-slot=slider-range]]:bg-primary/80 [&_[data-slot=slider-track]]:bg-muted/50"
                style={{ '--slider-color': CATEGORY_COLORS[cat] } as React.CSSProperties}
              />
            )}
          </div>
        ))}

        {/* Total indicator */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-sm font-medium text-foreground">Total</span>
          <span className={cn("font-money text-sm font-semibold", total === 100 ? "text-positive" : "text-destructive")}>
            {total}%
          </span>
        </div>

        {editing && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="h-7 text-xs">
              <Save className="h-3 w-3 mr-1" />Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 text-xs">
              Cancelar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Goals Section ───────────────────────────────────────────────────────────

function GoalsSection() {
  const { data: goals, isLoading } = trpc.goals.getAll.useQuery();
  const createMutation = trpc.goals.create.useMutation();
  const deleteMutation = trpc.goals.delete.useMutation();
  const utils = trpc.useUtils();

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");

  const handleAdd = () => {
    if (!name || !targetAmount) return;
    createMutation.mutate({
      title: name,
      targetAmount,
      targetDate: deadline ? new Date(deadline) : undefined,
      period: "optional",
      goalType: "optional" as const,
    }, {
      onSuccess: () => {
        utils.goals.getAll.invalidate();
        setShowAdd(false);
        setName("");
        setTargetAmount("");
        setDeadline("");
        toast.success("Meta adicionada.");
      },
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Metas Opcionais
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {isLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <>
            {goals?.filter((g: any) => g.goalType === "optional" || g.period === "optional" || !g.period).map((goal: any) => {
              const monthsLeft = goal.targetDate
                ? Math.max(1, Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)))
                : null;
              const suggested = goal.suggestedMonthlyAmount
                ? parseFloat(goal.suggestedMonthlyAmount)
                : (monthsLeft ? parseFloat(goal.targetAmount) / monthsLeft : null);

              return (
                <div key={goal.id} className="py-2 border-b border-border last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{goal.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-money text-sm text-primary">{formatMoney(parseFloat(goal.targetAmount))}</span>
                      <button
                        onClick={() => deleteMutation.mutate({ id: goal.id }, { onSuccess: () => utils.goals.getAll.invalidate() })}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {suggested && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Sugerido: {formatMoney(suggested)}/mês ({monthsLeft} meses restantes)
                    </p>
                  )}
                </div>
              );
            })}
            {showAdd ? (
              <div className="space-y-2 pt-2 border-t border-border">
                <Input placeholder="Nome da meta (ex: Viagem)" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Valor total" type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Prazo (opcional)" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-8 text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd} disabled={createMutation.isPending} className="h-7 text-xs">
                    <Check className="h-3 w-3 mr-1" />Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="h-7 text-xs">
                    <X className="h-3 w-3 mr-1" />Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)} className="w-full h-8 text-xs text-muted-foreground">
                <Plus className="h-3 w-3 mr-1" />Adicionar meta
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Planned Expenses Section ───────────────────────────────────────────────

function PlannedExpensesSection() {
  const { year, month } = useMonth();
  const { data: planned, isLoading } = trpc.planned.getExpenses.useQuery({ year, month });
  const createMutation = trpc.planned.create.useMutation();
  const utils = trpc.useUtils();

  const [showAdd, setShowAdd] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");

  const handleAdd = () => {
    if (!desc || !amount) return;
    createMutation.mutate({
      description: desc,
      amount,
      year,
      month,
      paymentType: "cash" as const,
      category: (category || "outros") as any,
      transactionDate: new Date(year, month - 1, 1),
    }, {
      onSuccess: () => {
        utils.planned.getExpenses.invalidate();
        utils.dashboard.getFunnel.invalidate();
        setShowAdd(false);
        setDesc("");
        setAmount("");
        setCategory("");
        toast.success("Gasto programado adicionado.");
      },
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-amber-400" />
          Gastos Programados
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {isLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <>
            {planned && planned.length > 0 ? (
              planned.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-foreground truncate">{p.description}</span>
                    {p.category && (
                      <Badge variant="secondary" className="text-[10px]">
                        {CATEGORY_LABELS[p.category] ?? p.category}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-money text-sm text-muted-foreground">{formatMoney(parseFloat(p.amount))}</span>
                    {p.isPaid && <Check className="h-3 w-3 text-positive" />}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhum gasto programado para este mês.
              </p>
            )}
            {showAdd ? (
              <div className="space-y-2 pt-2 border-t border-border">
                <Input placeholder="Descrição (ex: Personal Trainer)" value={desc} onChange={(e) => setDesc(e.target.value)} className="h-8 text-sm" />
                <div className="flex gap-2">
                  <Input placeholder="Valor" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 text-sm flex-1" />
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 text-xs rounded-md border border-border bg-background px-2">
                    <option value="">Categoria</option>
                    {VARIABLE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd} disabled={createMutation.isPending} className="h-7 text-xs">
                    <Check className="h-3 w-3 mr-1" />Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="h-7 text-xs">
                    <X className="h-3 w-3 mr-1" />Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)} className="w-full h-8 text-xs text-muted-foreground">
                <Plus className="h-3 w-3 mr-1" />Adicionar gasto programado
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Pluggy Connection Section ───────────────────────────────────────────────

function PluggySection() {
  const { data: connections, isLoading } = trpc.pluggy.getConnections.useQuery();
  const createTokenMutation = trpc.pluggy.createConnectToken.useMutation();

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Link2 className="h-4 w-4 text-blue-400" />
          Conexão Bancária (Pluggy)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {isLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <>
            {connections && connections.length > 0 ? (
              connections.map((conn: any) => (
                <div key={conn.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", conn.status === "updated" ? "bg-positive" : "bg-amber-400")} />
                    <span className="text-sm text-foreground">{conn.connectorName}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleDateString("pt-BR") : "Nunca sincronizado"}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-3">
                Nenhuma conta conectada.
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                createTokenMutation.mutate({}, {
                  onSuccess: (data) => {
                    if (data?.connectToken) {
                      window.open(`https://connect.pluggy.ai/?connectToken=${data.connectToken}`, "_blank");
                    }
                  },
                  onError: () => toast.error("Erro ao criar token de conexão."),
                });
              }}
              disabled={createTokenMutation.isPending}
              className="w-full h-8 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              {connections && connections.length > 0 ? "Adicionar outra conta" : "Conectar conta bancária"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Credit Cards Section ────────────────────────────────────────────────────

function CreditCardsSection() {
  const { data: cards, isLoading } = trpc.creditCards.getCards.useQuery();
  const createMutation = trpc.creditCards.create.useMutation();
  const utils = trpc.useUtils();

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [lastFour, setLastFour] = useState("");

  const handleAdd = () => {
    if (!name) return;
    createMutation.mutate({ name, lastFourDigits: lastFour || undefined }, {
      onSuccess: () => {
        utils.creditCards.getCards.invalidate();
        setShowAdd(false);
        setName("");
        setLastFour("");
        toast.success("Cartão adicionado.");
      },
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          Cartões de Crédito
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {isLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <>
            {cards?.map((card: any) => (
              <div key={card.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm text-foreground">{card.name}</span>
                </div>
                {card.lastFourDigits && (
                  <span className="font-money text-xs text-muted-foreground">****{card.lastFourDigits}</span>
                )}
              </div>
            ))}
            {showAdd ? (
              <div className="space-y-2 pt-2 border-t border-border">
                <Input placeholder="Nome do cartão" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Últimos 4 dígitos (opcional)" maxLength={4} value={lastFour} onChange={(e) => setLastFour(e.target.value)} className="h-8 text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd} disabled={createMutation.isPending} className="h-7 text-xs">
                    <Check className="h-3 w-3 mr-1" />Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="h-7 text-xs">
                    <X className="h-3 w-3 mr-1" />Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)} className="w-full h-8 text-xs text-muted-foreground">
                <Plus className="h-3 w-3 mr-1" />Adicionar cartão
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Configuracao() {
  return (
    <div className="p-4 pb-6 space-y-4 max-w-lg mx-auto">
      <Tabs defaultValue="orcamento" className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-9">
          <TabsTrigger value="orcamento" className="text-xs">Orçamento</TabsTrigger>
          <TabsTrigger value="metas" className="text-xs">Metas & Regras</TabsTrigger>
          <TabsTrigger value="conexao" className="text-xs">Conexão</TabsTrigger>
        </TabsList>

        <TabsContent value="orcamento" className="space-y-4 mt-4">
          <IncomeSection />
          <FixedExpensesSection />
          <CategoryPercentagesSection />
          <PlannedExpensesSection />
        </TabsContent>

        <TabsContent value="metas" className="space-y-4 mt-4">
          <GoalsSection />
        </TabsContent>

        <TabsContent value="conexao" className="space-y-4 mt-4">
          <CreditCardsSection />
          <PluggySection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
