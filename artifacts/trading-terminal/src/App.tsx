import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import AIPilotPage from "@/pages/ai-pilot";
import ChartPage from "@/pages/chart";
import DiscoverPage from "@/pages/discover";
import PortfolioPage from "@/pages/portfolio";
import AlertsPage from "@/pages/alerts";
import SettingsPage from "@/pages/settings";
import AutonomousPage from "@/pages/autonomous";
import RiskPage from "@/pages/risk";
import BacktestingPage from "@/pages/backtesting";
import SentimentPage from "@/pages/sentiment";
import BrokeragePage from "@/pages/brokerage";
import AnalysisPage from "@/pages/analysis";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 10000,
      retry: 1,
    }
  }
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/autopilot" component={AIPilotPage} />
        <Route path="/chart" component={ChartPage} />
        <Route path="/discover" component={DiscoverPage} />
        <Route path="/portfolio" component={PortfolioPage} />
        <Route path="/alerts" component={AlertsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/autonomous" component={AutonomousPage} />
        <Route path="/risk" component={RiskPage} />
        <Route path="/backtest" component={BacktestingPage} />
        <Route path="/sentiment" component={SentimentPage} />
        <Route path="/brokerage" component={BrokeragePage} />
        <Route path="/analysis" component={AnalysisPage} />
        {/* Legacy redirects */}
        <Route path="/watchlist"><Redirect to="/discover" /></Route>
        <Route path="/ideas"><Redirect to="/discover" /></Route>
        <Route path="/trade"><Redirect to="/autopilot" /></Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary label="App">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ErrorBoundary label="Router">
              <Router />
            </ErrorBoundary>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
