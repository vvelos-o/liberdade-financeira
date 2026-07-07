import { trpc } from "@/lib/trpc";
import { useMonth } from "@/contexts/MonthContext";
import { MoneyDisplay, formatMoney } from "@/components/finance/MoneyDisplay";
import { CategoryBadge, CATEGORY_LABELS, VARIABLE_CATEGORIES, type FinanceCategory } from "@/components/finance/CategoryBadge";
import { cn } from "@/lib/utils";
import { RefreshCw, Sparkles, Filter, Package, Calendar, Check, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";

// ─── Transaction Item ────────────────────────────────────────────────────────

function TransactionItem({ tx, onCategoryChange }: {
  tx: any;
  onCategoryChange: (id: number, category: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const date = new Date(tx.transactionDate);
  const isUncategorized = tx.category === "nao_categorizado";

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
              value={tx.category}
              onValueChange={(val) => {
                onCategoryChange(tx.id, val);
                setEditing(false);
              }}
            >
              <SelectTrigger className="h-6 text-[10px] w-auto min-w-[100px] px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VARIABLE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
                ))}
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="fixo">Fixo</SelectItem>
                <SelectItem value="investimento">Investimento</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <button onClick={() => setEditing(true)} className="transition-opacity hover:opacity-80">
              <CategoryBadge category={tx.category as FinanceCategory} size="sm" />
            </button>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <span className={cn(
          "font-money text-sm font-semibold",
          tx.type === "credit" ? "text-positive" : tx.type === "transfer" ? "text-muted-foreground" : "text-foreground"
        )}>
          {tx.type === "credit" ? "+" : tx.type === "transfer" ? "" : "-"}{formatMoney(parseFloat(tx.amount))}
        </span>
        {tx.type === "transfer" && (
          <span className="text-xs text-muted-foreground block">transferência</span>
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
  const { data: uncategorized } = trpc.pluggy.getUncategorized.useQuery({ limit: 50 });
  const syncMutation = trpc.pluggy.syncTransactions.useMutation();
  const aiSuggestMutation = trpc.pluggy.aiSuggestCategories.useMutation();
  const applyMutation = trpc.pluggy.applyCategories.useMutation();
  const correctMutation = trpc.pluggy.correctCategory.useMutation();
  const utils = trpc.useUtils();

  const uncategorizedCount = uncategorized?.length ?? 0;

  const filteredTransactions = transactions?.filter((tx: any) => {
    if (categoryFilter === "all") return true;
    if (categoryFilter === "uncategorized") return tx.category === "nao_categorizado";
    return tx.category === categoryFilter;
  }) ?? [];

  const handleSync = () => {
    syncMutation.mutate({}, {
      onSuccess: (data) => {
        toast.success(`Sincronizado! ${data.totalImported} transações importadas.`);
        utils.pluggy.getTransactions.invalidate();
        utils.pluggy.getUncategorized.invalidate();
        utils.dashboard.getFunnel.invalidate();
      },
      onError: () => toast.error("Erro ao sincronizar. Tente novamente."),
    });
  };

  const handleAICategorize = () => {
    const ids = (uncategorized ?? []).map((t: any) => t.id).slice(0, 50);
    if (ids.length === 0) return;
    aiSuggestMutation.mutate({ transactionIds: ids }, {
      onSuccess: (data: any) => {
        if (data.suggestions && data.suggestions.length > 0) {
          applyMutation.mutate({ updates: data.suggestions.map((s: any) => ({ id: s.id, category: s.category })) }, {
            onSuccess: (result: any) => {
              toast.success(`${result.applied} transações categorizadas pela IA.`);
              utils.pluggy.getTransactions.invalidate();
              utils.pluggy.getUncategorized.invalidate();
              utils.dashboard.getFunnel.invalidate();
            },
          });
        } else {
          toast.info("Nenhuma sugestão gerada.");
        }
      },
      onError: () => toast.error("Erro ao categorizar. Tente novamente."),
    });
  };

  const handleCategoryChange = (id: number, category: string) => {
    const tx = filteredTransactions.find((t: any) => t.id === id);
    if (!tx) return;
    // Optimistic update: immediately update the cache
    const queryKey = { year, month };
    utils.pluggy.getTransactions.setData(queryKey, (old: any) => {
      if (!old) return old;
      return old.map((t: any) => t.id === id ? { ...t, category, isReviewed: true } : t);
    });
    correctMutation.mutate({ transactionId: id, category: category as any, description: tx.description ?? "" }, {
      onSuccess: () => {
        toast.success("Categoria atualizada.");
        utils.pluggy.getUncategorized.invalidate();
        utils.dashboard.getFunnel.invalidate();
      },
      onError: (err) => {
        console.error("correctCategory error:", err);
        toast.error("Erro ao redefinir categoria. Tente novamente.");
        // Rollback optimistic update
        utils.pluggy.getTransactions.invalidate();
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

        {uncategorizedCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAICategorize}
            disabled={aiSuggestMutation.isPending}
            className="gap-1.5"
          >
            <Sparkles className={cn("h-3.5 w-3.5", aiSuggestMutation.isPending && "animate-spin")} />
            Categorizar ({uncategorizedCount})
          </Button>
        )}

        <div className="ml-auto">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[100px] gap-1">
              <Filter className="h-3 w-3" />
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="uncategorized">Pendentes</SelectItem>
              {VARIABLE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
              ))}
              <SelectItem value="receita">Receita</SelectItem>
              <SelectItem value="fixo">Fixo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Uncategorized Alert */}
      {uncategorizedCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-200">
            {uncategorizedCount} transaç{uncategorizedCount === 1 ? "ão" : "ões"} para categorizar
          </p>
        </div>
      )}

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
                <TransactionItem tx={tx} onCategoryChange={handleCategoryChange} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
