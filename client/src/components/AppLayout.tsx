import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  TrendingUp,
  Receipt,
  CreditCard,
  Calendar,
  CalendarClock,
  Target,
  BarChart3,
  Wifi,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Menu,
  X,
  Wallet,
  Layers,
  TrendingDown,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMonth } from "@/contexts/MonthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTH_NAMES_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const NAV_SECTIONS = [
  {
    label: "Visão Geral",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/fcp", icon: TrendingUp, label: "FCP" },
      { href: "/anual", icon: BarChart3, label: "Visão Anual" },
    ],
  },
  {
    label: "Receitas",
    items: [
      { href: "/receitas", icon: TrendingUp, label: "Receitas" },
    ],
  },
  {
    label: "Gastos",
    items: [
      { href: "/gastos-fixos", icon: Receipt, label: "Gastos Fixos" },
      { href: "/qualidade-de-vida", icon: Wallet, label: "Qualidade de Vida" },
      { href: "/gastos-a-prazo", icon: Layers, label: "Gastos a Prazo" },
      { href: "/gastos-programados", icon: CalendarClock, label: "Programados" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/cartoes", icon: CreditCard, label: "Cartões" },
      { href: "/metas", icon: Target, label: "Metas Financeiras" },
      { href: "/pluggy", icon: Wifi, label: "Open Finance" },
    ],
  },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const { year, month, setYearMonth } = useMonth();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    toast.success("Até logo!");
  };

  const prevMonth = () => {
    if (month === 1) setYearMonth(year - 1, 12);
    else setYearMonth(year, month - 1);
  };
  const nextMonth = () => {
    if (month === 12) setYearMonth(year + 1, 1);
    else setYearMonth(year, month + 1);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("flex items-center gap-3 px-4 py-5 border-b border-border", sidebarCollapsed && "justify-center px-2")}>
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <BarChart3 className="h-4 w-4 text-primary" />
        </div>
        {!sidebarCollapsed && (
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">Finance</p>
            <p className="text-xs font-semibold text-primary leading-tight">Master</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <div className="space-y-1 px-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              {!sidebarCollapsed && (
                <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider px-3 py-1.5 mt-2">{section.label}</p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link href={item.href}>
                        <motion.div
                          whileHover={{ x: sidebarCollapsed ? 0 : 2 }}
                          transition={{ duration: 0.15, ease: "easeOut" } as any}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 group",
                            sidebarCollapsed && "justify-center px-2",
                            isActive
                              ? "bg-primary/15 text-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                          )}
                        >
                          <Icon className={cn("flex-shrink-0 h-4 w-4", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                          {!sidebarCollapsed && (
                            <span className="text-sm font-medium truncate">{item.label}</span>
                          )}
                        </motion.div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* User section */}
      <div className={cn("border-t border-border p-3", sidebarCollapsed && "px-2")}>
        {user ? (
          <div className={cn("flex items-center gap-2", sidebarCollapsed && "justify-center")}>
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                {user.name?.charAt(0)?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{user.name ?? "Usuário"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email ?? ""}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={handleLogout}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => window.location.reload()}>
            <User className="h-4 w-4 mr-2" />
            {!sidebarCollapsed && "Entrar"}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 64 : 220 }}
        transition={{ duration: 0.2 }}
        className="hidden lg:flex flex-col bg-card border-r border-border flex-shrink-0 relative"
      >
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-16 z-10 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </motion.aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25 }}
              className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border z-50 lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="flex items-center justify-between px-4 lg:px-6 h-14 border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0">
          {/* Mobile menu + Month selector */}
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Month/Year Selector */}
            <div className="flex items-center gap-1 bg-secondary rounded-lg px-1 py-1">
              <button
                onClick={prevMonth}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-foreground px-2 min-w-[140px] text-center">
                {MONTH_NAMES_FULL[month - 1]} {year}
              </span>
              <button
                onClick={nextMonth}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Right: Quick year tabs */}
          <div className="flex items-center gap-2">
            {[year - 1, year, year + 1].map((y) => (
              <button
                key={y}
                onClick={() => setYearMonth(y, month)}
                className={cn(
                  "text-xs font-medium px-2.5 py-1 rounded-md transition-colors",
                  y === year ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {y}
              </button>
            ))}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
