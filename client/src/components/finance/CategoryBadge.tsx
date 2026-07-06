import { cn } from "@/lib/utils";
import { Utensils, Car, Heart, Gamepad2, MoreHorizontal, TrendingUp, Home, Briefcase, ShoppingBag, Shield } from "lucide-react";

export type FinanceCategory = "lazer" | "alimentacao" | "transporte" | "saude" | "outros" | "pessoal" | "imprevistos" | "receita" | "fixo" | "investimento" | "nao_categorizado";

const CATEGORY_CONFIG: Record<FinanceCategory, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  lazer: { label: "Lazer", icon: Gamepad2, color: "text-purple-400", bg: "bg-purple-400/10" },
  alimentacao: { label: "Alimentação", icon: Utensils, color: "text-orange-400", bg: "bg-orange-400/10" },
  transporte: { label: "Transporte", icon: Car, color: "text-blue-400", bg: "bg-blue-400/10" },
  saude: { label: "Saúde", icon: Heart, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  outros: { label: "Outros", icon: MoreHorizontal, color: "text-gray-400", bg: "bg-gray-400/10" },
  pessoal: { label: "Pessoal", icon: ShoppingBag, color: "text-pink-400", bg: "bg-pink-400/10" },
  imprevistos: { label: "Imprevistos", icon: Shield, color: "text-amber-400", bg: "bg-amber-400/10" },
  receita: { label: "Receita", icon: TrendingUp, color: "text-green-400", bg: "bg-green-400/10" },
  fixo: { label: "Fixo", icon: Home, color: "text-yellow-400", bg: "bg-yellow-400/10" },
  investimento: { label: "Investimento", icon: Briefcase, color: "text-teal-400", bg: "bg-teal-400/10" },
  nao_categorizado: { label: "Não categorizado", icon: MoreHorizontal, color: "text-gray-500", bg: "bg-gray-500/10" },
};

interface CategoryBadgeProps {
  category: FinanceCategory;
  showIcon?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function CategoryBadge({ category, showIcon = true, className, size = "md" }: CategoryBadgeProps) {
  const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.nao_categorizado;
  const Icon = config.icon;

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full font-medium",
      size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
      config.color,
      config.bg,
      className
    )}>
      {showIcon && <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />}
      {config.label}
    </span>
  );
}

export function getCategoryConfig(category: FinanceCategory) {
  return CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.nao_categorizado;
}

export const CATEGORY_COLORS: Record<string, string> = {
  lazer: "#a855f7",
  alimentacao: "#f97316",
  transporte: "#60a5fa",
  saude: "#34d399",
  outros: "#9ca3af",
  pessoal: "#f472b6",
  imprevistos: "#fbbf24",
};

export const VARIABLE_CATEGORIES = ["lazer", "alimentacao", "saude", "transporte", "pessoal", "imprevistos", "outros"] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  lazer: "Lazer",
  alimentacao: "Alimentação",
  transporte: "Transporte",
  saude: "Saúde",
  outros: "Outros",
  pessoal: "Pessoal",
  imprevistos: "Imprevistos",
};
