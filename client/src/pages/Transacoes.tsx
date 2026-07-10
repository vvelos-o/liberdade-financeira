import { trpc } from "@/lib/trpc";
import { useMonth } from "@/contexts/MonthContext";
import { MoneyDisplay, formatMoney } from "@/components/finance/MoneyDisplay";
import { CategoryBadge, CATEGORY_LABELS, VARIABLE_CATEGORIES, type FinanceCategory } from "@/components/finance/CategoryBadge";
import { cn } from "@/lib/utils";
import { RefreshCw, Filter, Package, Calendar, Check, Link2, Unlink, ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";

// ─── Transaction Item ────────────────────────────────────────────────────────

function TransactionItem({ tx, onCategoryChange, onLinkToFixed, onLinkToPlanned, onLinkToInstallment, onFlipType, fixedExpenses, plannedExpenses, installmentMonths, allInstallments }: {
  tx: any;
  onCategoryChange: (id: number, category: string) => void;
  onLinkToFixed: (id: number, fixedExpenseId: number) => void;
  onLinkToPlanned: (id: number, plannedExpenseId: number) => void;
  onLinkToInstallment: (id: number, installmentMonthId: number) => void;
  onFlipType: (id: number) => void;
  fixedExpenses: any[] | undefined;
  plannedExpenses: any[] | undefined;
  installmentMonths: any[] | undefined;
  allInstallments: any[] | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const date = new Date(tx.transactionDate);
  const isUncategorized = tx.category === "nao_categorizado";
  const isLinkedToFixed = tx.linkedExpenseType === "fixed" && tx.linkedExpenseId;
  const isLinkedToPlanned = tx.linkedExpenseType === "planned" && tx.linkedExpenseId;
  const isLinkedToInstallment = tx.linkedExpenseType === "installment" && tx.linkedExpenseId;
  const isLinked = isLinkedToFixed || isLinkedToPlanned || isLinkedToInstallment;

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg transition-colors",
      isUncategorized ? "bg-amber-500/5 border border-amber-500/20" : "hover:bg-secondary/40"
    )}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground">
            {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </span>
          {editing ? (
            <Select
              value={isLinkedToFixed ? `fixed_${tx.linkedExpenseId}` : isLinkedToPlanned ? `planned_${tx.linkedExpenseId}` : isLinkedToInstallment ? `installment_${tx.linkedExpenseId}` : tx.category}
              onValueChange={(val) => {
                if (val.startsWith("fixed_")) {
                  const fixedId = parseInt(val.replace("fixed_", ""), 10);
                  onLinkToFixed(tx.id, fixedId);
                } else if (val.startsWith("planned_")) {
                  const plannedId = parseInt(val.replace("planned_", ""), 10);
                  onLinkToPlanned(tx.id, plannedId);
                } else if (val.startsWith("installment_")) {
                  const instId = parseInt(val.replace("installment_", ""), 10);
                  onLinkToInstallment(tx.id, instId);
                } else if (val === "__unlink__") {
                  // Unlink: set back to nao_categorizado
                  onCategoryChange(tx.id, "nao_categorizado");
                } else {
                  onCategoryChange(tx.id, val);
                }
                setEditing(false);
              }}
            >
              <SelectTrigger className="h-6 text-[10px] w-auto min-w-[120px] px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel className="text-[10px]">Categorias</SelectLabel>
                  {VARIABLE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
                  ))}
                  <SelectItem value="receita">Receita Extra</SelectItem>
                  <SelectItem value="receita_contabilizada">Já Contabilizado</SelectItem>
                  <SelectItem value="fixo">Fixo (genérico)</SelectItem>
                  <SelectItem value="investimento">Investimento</SelectItem>
                </SelectGroup>

                {/* Fixed expense linking section - only for debits */}
                {tx.type === "debit" && fixedExpenses && fixedExpenses.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="text-[10px] flex items-center gap-1">
                        <Link2 className="h-3 w-3" />
                        Vincular a Gasto Fixo
                      </SelectLabel>
                      {fixedExpenses.map((fe: any) => (
                        <SelectItem key={`fixed_${fe.id}`} value={`fixed_${fe.id}`}>
                          {fe.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                )}

                {/* Planned expense linking section */}
                {tx.type === "debit" && plannedExpenses && plannedExpenses.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="text-[10px] flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Vincular a Gasto Programado
                      </SelectLabel>
                      {plannedExpenses.map((pe: any) => (
                        <SelectItem key={`planned_${pe.id}`} value={`planned_${pe.id}`}>
                          {pe.description} ({formatMoney(parseFloat(pe.amount))})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                )}

                {/* Installment linking section */}
                {tx.type === "debit" && installmentMonths && installmentMonths.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="text-[10px] flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        Vincular a Parcela
                      </SelectLabel>
                      {installmentMonths.map((im: any) => {
                        const parent = allInstallments?.find((a: any) => a.id === im.installmentExpenseId);
                        return (
                          <SelectItem key={`installment_${im.id}`} value={`installment_${im.id}`}>
                            {parent?.description ?? "Parcela"} ({im.installmentNumber}/{parent?.totalInstallments ?? "?"})
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  </>
                )}

                {/* Unlink option if currently linked */}
                {isLinked && (
                  <>
                    <SelectSeparator />
                    <SelectItem value="__unlink__" className="text-destructive">
                      <span className="flex items-center gap-1">
                        <Unlink className="h-3 w-3" />
                        Desvincular
                      </span>
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          ) : (
            <button onClick={() => setEditing(true)} className="transition-opacity hover:opacity-80">
              <div className="flex items-center gap-1">
                <CategoryBadge category={tx.category as FinanceCategory} size="sm" />
                {isLinked && (
                  <span className="text-[9px] text-primary flex items-center gap-0.5">
                    <Link2 className="h-2.5 w-2.5" />
                    vinculado
                  </span>
                )}
              </div>
            </button>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0 flex items-center gap-1">
        <button
          onClick={() => onFlipType(tx.id)}
          className="p-1 rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
          title="Inverter tipo (débito↔crédito)"
        >
          <ArrowUpDown className="h-3 w-3" />
        </button>
        <span className={cn(
          "font-money text-sm font-semibold",
          tx.category === "receita_contabilizada" ? "text-muted-foreground" :
          tx.category === "receita" ? "text-positive" :
          tx.type === "credit" ? "text-positive" : tx.type === "transfer" ? "text-muted-foreground" : "text-foreground"
        )}>
          {tx.type === "credit" ? "+" : tx.type === "transfer" ? "" : "-"}{formatMoney(parseFloat(tx.amount))}
        </span>
        {tx.type === "transfer" && (
          <span className="text-xs text-muted-foreground block">transferência</span>
        )}
        {tx.category === "receita_contabilizada" && (
          <span className="text-xs text-muted-foreground block">já na renda</span>
        )}
      </div>
    </div>
  );
}

// ─── Compromissos Section ────────────────────────────────────────────────────

function CompromissosSection({ year, month }: { year: number; month: number }) {
  const { data: installments } = trpc.installments.getMonthsForPeriod.useQuery({ year, month });
  const { data: planned } = trpc.planned.getExpenses.useQuery({ year, month });
  const { data: allInstallments } = trpc.installments.getAll.useQuery();

  const hasCompromissos = (installments && installments.length > 0) || (planned && planned.length > 0);

  if (!hasCompromissos) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          Compromissos do mês
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {/* Installments */}
        {installments?.map((inst) => {
          const parent = allInstallments?.find((a: any) => a.id === inst.installmentExpenseId);
          return (
            <div key={inst.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn("w-1.5 h-1.5 rounded-full", inst.isPaid ? "bg-positive" : "bg-muted-foreground")} />
                <span className="text-sm text-foreground truncate">
                  {parent?.description ?? "Parcela"}
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {inst.installmentNumber}/{parent?.totalInstallments ?? "?"}
                </Badge>
              </div>
              <span className="font-money text-sm text-muted-foreground">
                {formatMoney(parseFloat(inst.amount))}
              </span>
            </div>
          );
        })}

        {/* Planned expenses */}
        {planned?.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm text-foreground truncate">{p.description}</span>
              {p.category && (
                <CategoryBadge category={p.category as FinanceCategory} size="sm" showIcon={false} />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-money text-sm text-muted-foreground">
                {formatMoney(parseFloat(p.amount))}
              </span>
              {p.isPaid && <Check className="h-3 w-3 text-positive" />}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Transacoes() {
  const { year, month } = useMonth();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: transactions, isLoading } = trpc.pluggy.getTransactions.useQuery({ year, month });
  const { data: fixedExpenses } = trpc.fixedExpenses.getCategories.useQuery();
  const { data: plannedExpenses } = trpc.planned.getExpenses.useQuery({ year, month });
  const { data: installmentMonths } = trpc.installments.getMonthsForPeriod.useQuery({ year, month });
  const { data: allInstallments } = trpc.installments.getAll.useQuery();
  const syncMutation = trpc.pluggy.syncTransactions.useMutation();
  const updateCategoryMutation = trpc.pluggy.updateCategory.useMutation();
  const flipTypeMutation = trpc.pluggy.flipType.useMutation();
  const utils = trpc.useUtils();


  const filteredTransactions = transactions?.filter((tx: any) => {
    if (categoryFilter === "all") return true;
    if (categoryFilter === "uncategorized") return tx.category === "nao_categorizado";
    if (categoryFilter === "linked") return !!tx.linkedExpenseType;
    return tx.category === categoryFilter;
  }) ?? [];

  const handleSync = () => {
    syncMutation.mutate({}, {
      onSuccess: (data) => {
        toast.success(`Sincronizado! ${data.totalImported} transações importadas.`);
        utils.pluggy.getTransactions.invalidate();
        utils.dashboard.getFunnel.invalidate();
      },
      onError: () => toast.error("Erro ao sincronizar. Tente novamente."),
    });
  };


  const handleCategoryChange = (id: number, category: string) => {
    const tx = filteredTransactions.find((t: any) => t.id === id);
    if (!tx) return;
    // Optimistic update: immediately update the cache
    const queryKey = { year, month };
    utils.pluggy.getTransactions.setData(queryKey, (old: any) => {
      if (!old) return old;
      return old.map((t: any) => t.id === id ? { ...t, category, isReviewed: true, linkedExpenseId: null, linkedExpenseType: null } : t);
    });
    updateCategoryMutation.mutate({ id, category: category as any, linkedExpenseId: null, linkedExpenseType: null }, {
      onSuccess: () => {
        toast.success("Categoria atualizada.");
        utils.dashboard.getFunnel.invalidate();
      },
      onError: (err: any) => {
        console.error("updateCategory error:", err);
        toast.error("Erro ao redefinir categoria. Tente novamente.");
        // Rollback optimistic update
        utils.pluggy.getTransactions.invalidate();
        utils.dashboard.getFunnel.invalidate();
      },
    });
  };

  const handleLinkToFixed = (id: number, fixedExpenseId: number) => {
    // Optimistic update
    const queryKey = { year, month };
    utils.pluggy.getTransactions.setData(queryKey, (old: any) => {
      if (!old) return old;
      return old.map((t: any) => t.id === id ? { ...t, category: "fixo", linkedExpenseId: fixedExpenseId, linkedExpenseType: "fixed", isReviewed: true } : t);
    });
    updateCategoryMutation.mutate({
      id,
      category: "fixo",
      linkedExpenseId: fixedExpenseId,
      linkedExpenseType: "fixed",
    }, {
      onSuccess: () => {
        const fe = fixedExpenses?.find((f: any) => f.id === fixedExpenseId);
        toast.success(`Vinculado a "${fe?.name ?? "gasto fixo"}".`);
        utils.dashboard.getFunnel.invalidate();
      },
      onError: (err) => {
        console.error("linkToFixed error:", err);
        toast.error("Erro ao vincular. Tente novamente.");
        utils.pluggy.getTransactions.invalidate();
        utils.dashboard.getFunnel.invalidate();
      },
    });
  };

  const handleLinkToPlanned = (id: number, plannedExpenseId: number) => {
    const queryKey = { year, month };
    utils.pluggy.getTransactions.setData(queryKey, (old: any) => {
      if (!old) return old;
      return old.map((t: any) => t.id === id ? { ...t, category: "fixo", linkedExpenseId: plannedExpenseId, linkedExpenseType: "planned", isReviewed: true } : t);
    });
    updateCategoryMutation.mutate({
      id,
      category: "fixo",
      linkedExpenseId: plannedExpenseId,
      linkedExpenseType: "planned",
    }, {
      onSuccess: () => {
        const pe = plannedExpenses?.find((p: any) => p.id === plannedExpenseId);
        toast.success(`Vinculado a "${pe?.description ?? "gasto programado"}".`);
        utils.dashboard.getFunnel.invalidate();
      },
      onError: (err) => {
        console.error("linkToPlanned error:", err);
        toast.error("Erro ao vincular. Tente novamente.");
        utils.pluggy.getTransactions.invalidate();
        utils.dashboard.getFunnel.invalidate();
      },
    });
  };

  const handleLinkToInstallment = (id: number, installmentMonthId: number) => {
    const queryKey = { year, month };
    utils.pluggy.getTransactions.setData(queryKey, (old: any) => {
      if (!old) return old;
      return old.map((t: any) => t.id === id ? { ...t, category: "fixo", linkedExpenseId: installmentMonthId, linkedExpenseType: "installment", isReviewed: true } : t);
    });
    updateCategoryMutation.mutate({
      id,
      category: "fixo",
      linkedExpenseId: installmentMonthId,
      linkedExpenseType: "installment",
    }, {
      onSuccess: () => {
        const im = installmentMonths?.find((i: any) => i.id === installmentMonthId);
        const parent = allInstallments?.find((a: any) => a.id === im?.installmentExpenseId);
        toast.success(`Vinculado a "${parent?.description ?? "parcela"}".`);
        utils.dashboard.getFunnel.invalidate();
      },
      onError: (err) => {
        console.error("linkToInstallment error:", err);
        toast.error("Erro ao vincular. Tente novamente.");
        utils.pluggy.getTransactions.invalidate();
        utils.dashboard.getFunnel.invalidate();
      },
    });
  };

  const handleFlipType = (id: number) => {
    const tx = filteredTransactions.find((t: any) => t.id === id);
    if (!tx) return;
    const newType = tx.type === "debit" ? "credit" : "debit";
    // Optimistic update
    const queryKey = { year, month };
    utils.pluggy.getTransactions.setData(queryKey, (old: any) => {
      if (!old) return old;
      return old.map((t: any) => t.id === id ? { ...t, type: newType } : t);
    });
    flipTypeMutation.mutate({ id }, {
      onSuccess: () => {
        toast.success(`Tipo alterado para ${newType === "credit" ? "crédito (+)" : "débito (-)"}.`);
        utils.dashboard.getFunnel.invalidate();
      },
      onError: () => {
        toast.error("Erro ao inverter tipo. Tente novamente.");
        utils.pluggy.getTransactions.invalidate();
        utils.dashboard.getFunnel.invalidate();
      },
    });
  };

  return (
    <div className="p-4 pb-6 space-y-4 max-w-lg mx-auto">
      {/* Action Bar */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncMutation.isPending}
          className="gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", syncMutation.isPending && "animate-spin")} />
          Sync
        </Button>



        <div className="ml-auto">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[100px] gap-1">
              <Filter className="h-3 w-3" />
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="uncategorized">Pendentes</SelectItem>
              <SelectItem value="linked">Vinculados</SelectItem>
              {VARIABLE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
              ))}
              <SelectItem value="receita">Receita</SelectItem>
              <SelectItem value="fixo">Fixo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>



      {/* Compromissos */}
      <CompromissosSection year={year} month={month} />

      {/* Transaction List */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">
          Transações ({filteredTransactions.length})
        </h2>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <Card className="bg-card border-border border-dashed">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma transação encontrada para este período.
              </p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={handleSync}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Sincronizar agora
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1">
            {filteredTransactions.map((tx: any, index: number) => (
              <div key={tx.id} className="stagger-item" style={{ animationDelay: `${index * 30}ms` }}>
                <TransactionItem
                  tx={tx}
                  onCategoryChange={handleCategoryChange}
                  onLinkToFixed={handleLinkToFixed}
                  onLinkToPlanned={handleLinkToPlanned}
                  onLinkToInstallment={handleLinkToInstallment}
                  onFlipType={handleFlipType}
                  fixedExpenses={fixedExpenses}
                  plannedExpenses={plannedExpenses}
                  installmentMonths={installmentMonths}
                  allInstallments={allInstallments}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
