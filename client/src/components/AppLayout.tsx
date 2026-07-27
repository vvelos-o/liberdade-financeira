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
      {/* Top Header - Month Selector centered */}
      <header className="flex items-center justify-center px-3 h-12 border-b border-border header-gradient backdrop-blur-md flex-shrink-0 safe-top relative">
        {/* Logo + Wordmark - absolute left */}
        <div className="absolute left-3 flex items-center gap-1.5">
          <img src="/sobra-logo.svg" alt="Sobra" className="h-6 w-auto" />
          <span className="text-xs font-medium tracking-[-0.5px] hidden xs:inline" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>sobra</span>
        </div>
        {/* Month Navigation - always centered */}
        <div className="flex items-center gap-0">
          <button
            onClick={prevMonth}
            disabled={!canGoPrev}
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-full transition-colors active:scale-90",
              canGoPrev
                ? "text-foreground/80 hover:text-foreground hover:bg-secondary/60"
                : "text-muted-foreground/20 cursor-not-allowed"
            )}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold font-display text-foreground px-2 min-w-[130px] text-center select-none">
            {MONTH_NAMES_FULL[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="w-10 h-10 flex items-center justify-center rounded-full text-foreground/80 hover:text-foreground hover:bg-secondary/60 transition-colors active:scale-90"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
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
