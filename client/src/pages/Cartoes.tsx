import { useMonth } from "@/contexts/MonthContext";
import { trpc } from "@/lib/trpc";
import { MoneyDisplay } from "@/components/finance/MoneyDisplay";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Plus, CreditCard, Check, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useState } from "react";

const CARD_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#3b82f6", "#22c55e", "#eab308"];

export default function Cartoes() {
  const { year, month, monthLabel } = useMonth();
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", lastFourDigits: "", color: CARD_COLORS[0] });

  const { data: cards } = trpc.creditCards.getCards.useQuery();
  const { data: monthly } = trpc.creditCards.getMonthly.useQuery({ year, month });

  const create = trpc.creditCards.create.useMutation({
    onSuccess: () => { utils.creditCards.getCards.invalidate(); setShowAdd(false); setForm({ name: "", lastFourDigits: "", color: CARD_COLORS[0] }); toast.success("Cartão adicionado!"); },
  });

  const update = trpc.creditCards.update.useMutation({
    onSuccess: () => utils.creditCards.getCards.invalidate(),
  });

  const markPaid = trpc.creditCards.markPaid.useMutation({
    onSuccess: () => utils.creditCards.getMonthly.invalidate(),
  });

  const totalFatura = (monthly ?? []).reduce((a, b) => a + parseFloat(b.totalAmount), 0);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Cartões de Crédito</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total faturas</p>
            <MoneyDisplay value={totalFatura} size="lg" className="text-blue-400" />
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Cartão
          </Button>
        </div>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards?.map((card, idx) => {
          const monthData = monthly?.find((m) => m.creditCardId === card.id);
          const fatura = parseFloat(monthData?.totalAmount ?? "0");
          const isPaid = monthData?.isPaid ?? false;

          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
            >
              <Card className={cn("bg-card border-border overflow-hidden", isPaid && "opacity-70")}>
                {/* Card visual header */}
                <div
                  className="h-24 relative p-4 flex flex-col justify-between"
                  style={{ background: `linear-gradient(135deg, ${card.color ?? "#6366f1"}cc, ${card.color ?? "#6366f1"}55)` }}
                >
                  <div className="flex items-start justify-between">
                    <CreditCard className="h-6 w-6 text-white/80" />
                    {isPaid && (
                      <Badge className="bg-positive/90 text-background text-xs border-0">
                        <Check className="h-3 w-3 mr-1" />Pago
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-bold text-base">{card.name}</p>
                    {card.lastFourDigits && (
                      <p className="text-white/60 text-xs">•••• {card.lastFourDigits}</p>
                    )}
                  </div>
                </div>

                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Fatura {monthData ? `${month}/${year}` : "—"}</p>
                      <MoneyDisplay value={fatura} size="lg" className={fatura > 0 ? "text-foreground" : "text-muted-foreground"} />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={isPaid ? "secondary" : "default"}
                        className="h-8 text-xs gap-1"
                        onClick={() => markPaid.mutate({ creditCardId: card.id, year, month, isPaid: !isPaid })}
                        disabled={fatura === 0}
                      >
                        <Check className="h-3 w-3" />
                        {isPaid ? "Desmarcar" : "Marcar pago"}
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => update.mutate({ id: card.id, isActive: false })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {/* Empty state */}
        {(!cards || cards.length === 0) && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CreditCard className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Nenhum cartão cadastrado</p>
            <p className="text-xs mt-1">Adicione seus cartões para rastrear faturas</p>
          </div>
        )}
      </div>

      {/* Monthly Summary Table */}
      {monthly && monthly.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Resumo de Faturas — {month}/{year}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {monthly.map((m) => {
                const card = cards?.find((c) => c.id === m.creditCardId);
                const total = parseFloat(m.totalAmount);
                return (
                  <div key={m.creditCardId} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: card?.color ?? "#6366f1" }} />
                      <span className="text-sm text-foreground">{card?.name ?? `Cartão ${m.creditCardId}`}</span>
                      {m.isPaid && <Badge className="text-xs h-4 bg-positive/20 text-positive border-0">Pago</Badge>}
                    </div>
                    <MoneyDisplay value={total} size="sm" className={m.isPaid ? "text-muted-foreground" : "text-blue-400"} />
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-bold text-foreground">TOTAL</span>
                <MoneyDisplay value={totalFatura} size="sm" className="font-bold text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Card Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Novo Cartão de Crédito</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Nome do cartão</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Nubank, Itaú Platinum..." />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Últimos 4 dígitos (opcional)</label>
              <Input value={form.lastFourDigits} onChange={(e) => setForm({ ...form, lastFourDigits: e.target.value.slice(0, 4) })} placeholder="1234" maxLength={4} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Cor</label>
              <div className="flex gap-2 flex-wrap">
                {CARD_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setForm({ ...form, color })}
                    className={cn("w-7 h-7 rounded-full border-2 transition-all", form.color === color ? "border-white scale-110" : "border-transparent")}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate({ name: form.name, lastFourDigits: form.lastFourDigits || undefined, color: form.color })} disabled={!form.name.trim()}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
