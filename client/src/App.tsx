import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MonthProvider } from "./contexts/MonthContext";
import { AppLayout } from "./components/AppLayout";
import { useAuth } from "./_core/hooks/useAuth";
import { getLoginUrl } from "./const";
import { Loader2 } from "lucide-react";

// Pages
import Dashboard from "./pages/Dashboard";
import Receitas from "./pages/Receitas";
import GastosFixos from "./pages/GastosFixos";
import QualidadeDeVida from "./pages/QualidadeDeVida";
import GastosAPrazo from "./pages/GastosAPrazo";
import GastosProgramados from "./pages/GastosProgramados";
import Cartoes from "./pages/Cartoes";
import Metas from "./pages/Metas";
import VisaoAnual from "./pages/VisaoAnual";
import OpenFinance from "./pages/OpenFinance";
import FCP from "./pages/FCP";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 text-center max-w-sm px-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Finance Master</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Sua gestão financeira pessoal inteligente. Conecte-se para continuar.
            </p>
          </div>
          <a
            href={getLoginUrl()}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold py-2.5 px-6 rounded-lg transition-colors text-sm"
          >
            Entrar com Manus
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/receitas" component={Receitas} />
        <Route path="/gastos-fixos" component={GastosFixos} />
        <Route path="/qualidade-de-vida" component={QualidadeDeVida} />
        <Route path="/gastos-a-prazo" component={GastosAPrazo} />
        <Route path="/gastos-programados" component={GastosProgramados} />
        <Route path="/cartoes" component={Cartoes} />
        <Route path="/metas" component={Metas} />
        <Route path="/anual" component={VisaoAnual} />
        <Route path="/pluggy" component={OpenFinance} />
        <Route path="/fcp" component={FCP} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <MonthProvider>
          <TooltipProvider>
            <Toaster />
            <AuthGate>
              <AppRoutes />
            </AuthGate>
          </TooltipProvider>
        </MonthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
