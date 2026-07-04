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
import { useState, lazy, Suspense } from "react";

// Pages - lazy loaded for code splitting
const Inicio = lazy(() => import("./pages/Inicio"));
const Transacoes = lazy(() => import("./pages/Transacoes"));
const Configuracao = lazy(() => import("./pages/Configuracao"));
const Historico = lazy(() => import("./pages/Historico"));

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

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
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Inicio} />
          <Route path="/transacoes" component={Transacoes} />
          <Route path="/configuracao" component={Configuracao} />
          <Route path="/historico" component={Historico} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
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
