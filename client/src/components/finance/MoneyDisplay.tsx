import { cn } from "@/lib/utils";

interface MoneyDisplayProps {
  value: number;
  className?: string;
  showSign?: boolean;
  colorize?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  prefix?: string;
}

const sizeClasses = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
};

export function MoneyDisplay({ value, className, showSign = false, colorize = false, size = "md", prefix }: MoneyDisplayProps) {
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(Math.abs(value));

  const sign = showSign ? (value >= 0 ? "+" : "-") : value < 0 ? "-" : "";
  const colorClass = colorize ? (value >= 0 ? "text-positive" : "text-negative") : "";

  return (
    <span className={cn("font-money font-semibold", sizeClasses[size], colorClass, className)}>
      {prefix && <span className="text-muted-foreground mr-0.5">{prefix}</span>}
      {sign}{formatted}
    </span>
  );
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatMoneyCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(1)}k`;
  }
  return formatMoney(value);
}
