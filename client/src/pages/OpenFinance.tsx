import { useMonth } from "@/contexts/MonthContext";
import { trpc } from "@/lib/trpc";
import { MoneyDisplay } from "@/components/finance/MoneyDisplay";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Wifi, WifiOff, RefreshCw, CheckCircle2, Zap, Link2,
  Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useMemo } from "react";

const CATEGORIES = [
  { value: "lazer", label: "Lazer", color: "text-purple-400 bg-purple-400/10" },
  { value: "alimentacao", label: "Alimentação", color: "text-orange-400 bg-orange-400/10" },
  { value: "transporte", label: "Transporte", color: "text-blue-400 bg-blue-400/10" },
  { value: "saude", label: "Saúde", color: "text-green-400 bg-green-400/10" },
  { value: "pessoal", label: "Pessoal", color: "text-pink-400 bg-pink-400/10" },
  { value: "imprevistos", label: "Imprevistos", color: "text-red-400 bg-red-400/10" },
  { value: "fixo", label: "Fixo", color: "text-yellow-400 bg-yellow-400/10" },
  { value: "investimento", label: "Investimento", color: "text-teal-400 bg-teal-400/10" },
  { value: "receita", label: "Receita", color: "text-emerald-400 bg-emerald-400/10" },
  { value: "receita_contabilizada", label: "Receita Contabilizada", color: "text-emerald-300 bg-emerald-300/10" },
  { value: "outros", label: "Outros", color: "text-gray-400 bg-gray-400/10" },
  { value: "nao_categorizado", label: "Não categorizado", color: "text-muted-foreground bg-secondary" },
] as const;

type CategoryValue = typeof CATEGORIES[number]["value"];

function getCategoryStyle(cat: string) {
  return CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[CATEGORIES.length - 1];
}

export default function OpenFinance() {
  const { year, month } = useMonth();
  const utils = trpc.useUtils();
  const [syncing, setSyncing] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { data: status } = trpc.pluggy.getStatus.useQuery();
  const { data: transactions } = trpc.pluggy.getTransactions.useQuery({ year, month });
  const { data: connections } = trpc.pluggy.getConnections.useQuery();

  const syncMutation = trpc.pluggy.syncTransactions.useMutation({
    onSuccess: (data) => {
      setSyncing(false);
      utils.pluggy.getTransactions.invalidate();
      utils.pluggy.getConnections.invalidate();
      utils.dashboard.getFunnel.invalidate();
      toast.success(`Sincronizado! ${(data as { totalImported: number }).totalImported} transações importadas.`);
    },
    onError: (err) => {
      setSyncing(false);
      toast.error(`Erro ao sincronizar: ${err.message}`);
    },
  });

  const connectMutation = trpc.pluggy.createConnectToken.useMutation({
    onSuccess: (data) => {
      const d = data as { connectToken: string };
      if (d.connectToken) {
        window.open(`https://meu.pluggy.ai?token=${d.connectToken}`, "_blank");
      }
    },
    onError: () => toast.error("Configure as credenciais Pluggy primeiro"),
  });

  const updateCategoryMutation = trpc.pluggy.updateCategory.useMutation({
    onSuccess: () => {
      utils.pluggy.getTransactions.invalidate();
      utils.dashboard.getFunnel.invalidate();
      toast.success("Categoria atualizada!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const isConfigured = status?.configured ?? false;
  const hasConnections = (connections?.length ?? 0) > 0;

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    if (filterCategory === "all") return transactions;
    return transactions.filter((t: any) => t.category === filterCategory);
  }, [transactions, filterCategory]);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Open Finance</h1>
          <p className="text-sm text-muted-foreground">Sincronização automática via Meu Pluggy</p>
        </div>
        <div className="flex items-center gap-2">
          {isConfigured && (
            <Button
              size="sm"
              onClick={() => { setSyncing(true); syncMutation.mutate({}); }}
              disabled={syncing}
              className="gap-2"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
              Sincronizar Agora
            </Button>
          )}
        </div>
      </div>

      {/* Status Card */}
      <Card className={cn("bg-card border-border", isConfigured ? "border-positive/30" : "border-warning/30")}>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className={cn("p-3 rounded-xl", isConfigured ? "bg-positive/10" : "bg-warning/10")}>
              {isConfigured ? <Wifi className="h-6 w-6 text-positive" /> : <WifiOff className="h-6 w-6 text-warning" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-foreground">
                  {isConfigured ? "Pluggy Configurado" : "Pluggy não configurado"}
                </h3>
                <Badge variant={isConfigured ? "default" : "secondary"} className={cn("text-xs", isConfigured && "bg-positive/20 text-positive border-0")}>
                  {isConfigured ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {isConfigured
                  ? `${connections?.length ?? 0} conexão(ões) ativa(s). Sincronização automática via webhook.`
                  : "Configure suas credenciais Pluggy para habilitar a sincronização automática de transações."}
              </p>
              {!isConfigured && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Para configurar: vá em <strong>Configurações → Segredos</strong> e adicione{" "}
                    <code className="bg-secondary px-1 rounded text-xs">PLUGGY_CLIENT_ID</code> e{" "}
                    <code className="bg-secondary px-1 rounded text-xs">PLUGGY_CLIENT_SECRET</code>.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Obtenha suas credenciais em{" "}
                    <a href="https://meu.pluggy.ai" target="_blank" rel="noopener" className="text-primary underline">
                      meu.pluggy.ai
                    </a>{" "}
                    (gratuito para uso pessoal).
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      {!isConfigured && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Como funciona</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {[
                { step: "1", icon: Link2, title: "Crie conta no Meu Pluggy", desc: "Acesse meu.pluggy.ai e crie uma conta gratuita de desenvolvedor" },
                { step: "2", icon: CheckCircle2, title: "Obtenha suas credenciais", desc: "No painel Pluggy, copie o CLIENT_ID e CLIENT_SECRET do seu projeto" },
                { step: "3", icon: Zap, title: "Configure no Finance Master", desc: "Adicione as credenciais nas configurações do projeto (Secrets)" },
                { step: "4", icon: Wifi, title: "Conecte seu banco", desc: "Use o botão 'Conectar Banco' para vincular sua conta Nubank via Open Finance" },
              ].map((item) => {
                return (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">{item.step}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connected Accounts */}
      {isConfigured && connections && connections.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Conexões Ativas</CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => connectMutation.mutate({})}>
                <Link2 className="h-3 w-3" />
                Adicionar conta
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {connections.map((conn) => (
                <div key={conn.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">{conn.connectorName ?? conn.pluggyItemId}</p>
                    <p className="text-xs text-muted-foreground">
                      {conn.status} • {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString("pt-BR") : "Nunca sincronizado"}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{conn.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connect button when configured but no connections */}
      {isConfigured && !hasConnections && (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-8 flex flex-col items-center justify-center text-center">
            <Wifi className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Nenhuma conta conectada</p>
            <p className="text-xs text-muted-foreground mb-4">
              Conecte seu banco via Open Finance para importar transações automaticamente
            </p>
            <Button onClick={() => connectMutation.mutate({})} className="gap-2">
              <Link2 className="h-4 w-4" />
              Conectar Banco
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Transactions with filter */}
      {transactions && transactions.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">Transações Importadas</CardTitle>
                <Badge variant="secondary" className="text-xs">{filteredTransactions.length} de {transactions.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="h-7 text-xs w-40">
                    <SelectValue placeholder="Filtrar categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todas as categorias</SelectItem>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
              {filteredTransactions.map((tx: any, idx: number) => {
                const catStyle = getCategoryStyle(tx.category ?? "nao_categorizado");
                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(idx * 0.015, 0.3) }}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-secondary/40 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground truncate">{tx.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {new Date(tx.transactionDate).toLocaleDateString("pt-BR")}
                          </span>
                          {tx.category && (
                            <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", catStyle.color)}>
                              {catStyle.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Quick category change */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <Select
                          value={tx.category ?? "nao_categorizado"}
                          onValueChange={(val) => {
                            updateCategoryMutation.mutate({
                              id: tx.id,
                              category: val as any,
                            });
                          }}
                        >
                          <SelectTrigger className="h-6 text-xs w-32 border-border/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => (
                              <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <MoneyDisplay
                        value={parseFloat(tx.amount)}
                        size="sm"
                        className={tx.type === "credit" ? "text-positive" : "text-rose-400"}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhook info */}
      {isConfigured && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Zap className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground mb-1">Webhook configurado</p>
                <p className="text-xs text-muted-foreground">
                  Transações são importadas automaticamente quando detectadas pelo Pluggy. Configure o webhook no painel Pluggy apontando para:
                </p>
                <code className="text-xs bg-secondary px-2 py-1 rounded mt-1 block font-mono text-primary">
                  {window.location.origin}/api/webhooks/pluggy
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
