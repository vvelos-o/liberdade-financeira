import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  Home,
  ArrowLeftRight,
  Settings,
  BarChart3,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useMonth } from "@/contexts/MonthContext";

const MONTH_NAMES_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Início" },
  { href: "/transacoes", icon: ArrowLeftRight, label: "Transações" },
  { href: "/investimentos", icon: TrendingUp, label: "Invest" },
  { href: "/configuracao", icon: Settings, label: "Config" },
  { href: "/historico", icon: BarChart3, label: "Histórico" },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { year, month, setYearMonth } = useMonth();

  // Data starts from July 2026 - block navigation before that
  const DATA_START_YEAR = 2026;
  const DATA_START_MONTH = 7;
  const canGoPrev = year > DATA_START_YEAR || (year === DATA_START_YEAR && month > DATA_START_MONTH);

  const prevMonth = () => {
    if (!canGoPrev) return;
    if (month === 1) setYearMonth(year - 1, 12);
    else setYearMonth(year, month - 1);
  };
  const nextMonth = () => {
    if (month === 12) setYearMonth(year + 1, 1);
    else setYearMonth(year, month + 1);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background overflow-hidden">
      {/* Top Header - Logo + Month Selector */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-border header-gradient backdrop-blur-md flex-shrink-0 safe-top">
        {/* Logo + Wordmark */}
        <div className="flex items-center gap-2">
          <img src="/manus-storage/sobra-logo_f6e9c7fc.webp" alt="Sobra" className="h-7 w-7" />
          <span className="text-sm font-medium tracking-[-0.5px]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>sobra</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            disabled={!canGoPrev}
            className={cn(
              "p-2 rounded-lg transition-colors active:scale-95",
              canGoPrev
                ? "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                : "text-muted-foreground/30 cursor-not-allowed"
            )}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold font-display text-foreground px-3 min-w-[150px] text-center select-none">
            {MONTH_NAMES_FULL[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors active:scale-95"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {/* Spacer for balance */}
        <div className="w-[88px]"></div>
      </header>

      {/* Page Content */}
      <main className="flex-1 overflow-y-auto overscroll-contain" role="main" aria-label="Conteúdo principal">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="flex items-center justify-around border-t border-border bg-card/80 backdrop-blur-md flex-shrink-0 h-16 pb-[env(safe-area-inset-bottom,0px)]" role="navigation" aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/"
            ? location === "/"
            : location.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <button
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 w-16 h-12 rounded-xl transition-all duration-150",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label={`Navegar para ${item.label}`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_oklch(0.72_0.18_165/0.5)]")} strokeWidth={isActive ? 2.5 : 2} />
                <span className={cn("text-[10px] font-medium leading-tight", isActive && "font-semibold")}>{item.label}</span>
              </button>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
