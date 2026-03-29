import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAppState } from "@/hooks/use-app-state";
import { useGetPortfolio } from "@workspace/api-client-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { 
  LayoutDashboard, List, LineChart, Brain, Lightbulb, 
  ArrowRightLeft, PieChart, Bell, Settings, Search,
  Activity
} from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/watchlist', label: 'Watchlist', icon: List },
  { path: '/chart', label: 'Charts', icon: LineChart },
  { path: '/analysis', label: 'AI Analysis', icon: Brain },
  { path: '/ideas', label: 'Trade Ideas', icon: Lightbulb },
  { path: '/trade', label: 'Paper Trading', icon: ArrowRightLeft },
  { path: '/portfolio', label: 'Portfolio', icon: PieChart },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { selectedSymbol, setSelectedSymbol } = useAppState();
  const [searchInput, setSearchInput] = useState(selectedSymbol);
  
  const { data: portfolio } = useGetPortfolio({
    query: { retry: false, staleTime: 60000 }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSelectedSymbol(searchInput.trim());
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans selection:bg-primary/30">
      
      {/* Sidebar */}
      <aside className="w-16 lg:w-64 border-r border-border/50 bg-card/50 flex flex-col transition-all duration-300 backdrop-blur-xl z-20">
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-border/50">
          <Activity className="w-6 h-6 text-primary drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
          <span className="hidden lg:block ml-3 font-bold tracking-tight text-lg">TRADER SAGE</span>
        </div>
        <nav className="flex-1 py-6 flex flex-col gap-2 px-3">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            return (
              <Link key={item.path} href={item.path} className="relative block">
                <div className={`flex items-center p-3 rounded-xl transition-all duration-200 group ${
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}>
                  {isActive && (
                    <motion.div layoutId="sidebar-active" className="absolute left-0 w-1 h-8 bg-primary rounded-r-full" />
                  )}
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" : ""}`} />
                  <span className="hidden lg:block ml-3 font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0">
        
        {/* Header */}
        <header className="h-16 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 z-10 sticky top-0">
          <div className="flex items-center gap-4 lg:gap-8 flex-1">
            <form onSubmit={handleSearch} className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                placeholder="Search symbol..."
                className="w-full bg-input/50 border border-border rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono transition-all"
              />
            </form>
            <div className="hidden md:flex items-center gap-6 px-4 py-1.5 rounded-full bg-muted/30 border border-border/50 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">ACTIVE:</span>
                <span className="text-primary font-bold">{selectedSymbol}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {portfolio && (
              <div className="hidden sm:flex items-center gap-6 text-sm font-mono">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-muted-foreground uppercase">Equity</span>
                  <span className="font-bold text-foreground">{formatCurrency(portfolio.equity)}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-muted-foreground uppercase">Day P&L</span>
                  <span className={`font-bold ${portfolio.todayPnl >= 0 ? "text-bullish drop-shadow-[0_0_4px_rgba(16,185,129,0.3)]" : "text-bearish drop-shadow-[0_0_4px_rgba(239,68,68,0.3)]"}`}>
                    {portfolio.todayPnl >= 0 ? "+" : ""}{formatCurrency(portfolio.todayPnl)}
                  </span>
                </div>
              </div>
            )}
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-accent border border-primary/20 flex items-center justify-center text-xs font-bold shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              TS
            </div>
          </div>
        </header>

        {/* Workspace */}
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 bg-gradient-to-br from-background via-background to-muted/10">
          <div className="max-w-[1600px] mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
