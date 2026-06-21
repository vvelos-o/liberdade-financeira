import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MonthProvider } from "./contexts/MonthContext";
import { AppLayout } from "./components/AppLayout";
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import Login from "./pages/Login";
import { useState } from "react";

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
  const { isAuthenticated, loading, refresh } = useAuth();
  const [loginKey, setLoginKey] = useState(0);

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
      <Login
        key={loginKey}
        onSuccess={() => {
          setLoginKey(k => k + 1);
          refresh();
        }}
      />
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
