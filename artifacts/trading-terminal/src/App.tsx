import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import WatchlistPage from "@/pages/watchlist";
import ChartPage from "@/pages/chart";
import AnalysisPage from "@/pages/analysis";
import TradeIdeasPage from "@/pages/trade-ideas";
import PaperTradingPage from "@/pages/paper-trading";
import PortfolioPage from "@/pages/portfolio";
import AlertsPage from "@/pages/alerts";
import SettingsPage from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5000,
      retry: 1,
    }
  }
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/watchlist" component={WatchlistPage} />
        <Route path="/chart" component={ChartPage} />
        <Route path="/analysis" component={AnalysisPage} />
        <Route path="/ideas" component={TradeIdeasPage} />
        <Route path="/trade" component={PaperTradingPage} />
        <Route path="/portfolio" component={PortfolioPage} />
        <Route path="/alerts" component={AlertsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
