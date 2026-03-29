import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAppState } from "@/hooks/use-app-state";
import { useGetPortfolio, useGetMarketMovers } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import {
  LayoutDashboard, Sparkles, LineChart, Compass, Briefcase,
  Settings, Search, X, ChevronRight, TrendingUp, TrendingDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const POPULAR = ["AAPL","NVDA","MSFT","TSLA","META","GOOGL","AMZN","AMD","SPY","BTC","ETH","SOL"];

const navItems = [
  { path: "/",          label: "Home",      icon: LayoutDashboard, desc: "Market overview" },
  { path: "/autopilot", label: "AI Pilot",  icon: Sparkles,        desc: "AI controls your trades", highlight: true },
  { path: "/chart",     label: "Charts",    icon: LineChart,        desc: "Price charts" },
  { path: "/discover",  label: "Discover",  icon: Compass,         desc: "Find opportunities" },
  { path: "/portfolio", label: "Portfolio", icon: Briefcase,       desc: "Your positions & P&L" },
  { path: "/settings",  label: "Settings",  icon: Settings,        desc: "Preferences" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { selectedSymbol, setSelectedSymbol } = useAppState();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: portfolio } = useGetPortfolio({ query: { retry: false, staleTime: 30000 } });
  const { data: movers } = useGetMarketMovers({ query: { retry: false, staleTime: 60000 } });

  const pnlPositive = (portfolio?.todayPnl ?? 0) >= 0;

  const handleSearch = (sym: string) => {
    if (!sym.trim()) return;
    setSelectedSymbol(sym.trim().toUpperCase());
    setSearch("");
    setSearchOpen(false);
  };

  const filteredSuggestions = search.length > 0
    ? POPULAR.filter(s => s.includes(search.toUpperCase())).slice(0, 6)
    : POPULAR.slice(0, 8);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searchOpen]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* Sidebar */}
      <aside className="w-[72px] lg:w-60 border-r border-border/50 flex flex-col shrink-0 bg-card/40">

        {/* Logo */}
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-5 border-b border-border/40">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="hidden lg:block ml-3">
            <p className="font-bold text-sm tracking-tight leading-none">AI Trader</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Paper trading only</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
          {navItems.map(item => {
            const active = location === item.path || (item.path === "/autopilot" && location === "/autopilot");
            const Icon = item.icon;
            return (
              <Link key={item.path} href={item.path}>
                <div className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group cursor-pointer",
                  active
                    ? item.highlight ? "bg-primary/15 text-primary" : "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}>
                  {active && <motion.div layoutId="nav-pill" className={cn("absolute inset-0 rounded-xl", item.highlight ? "bg-primary/10 border border-primary/20" : "bg-muted")} style={{ zIndex: -1 }} />}
                  <Icon className={cn("w-[18px] h-[18px] shrink-0", active && item.highlight && "text-primary", active && !item.highlight && "text-foreground")} />
                  <div className="hidden lg:block min-w-0">
                    <p className={cn("text-sm font-medium leading-none", item.highlight && active && "text-primary")}>{item.label}</p>
                    {!active && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{item.desc}</p>}
                  </div>
                  {item.highlight && !active && (
                    <span className="hidden lg:block ml-auto text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md border border-primary/20">AI</span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Portfolio mini */}
        {portfolio && (
          <div className="m-2 p-3 rounded-xl border border-border/50 bg-muted/30">
            <p className="text-[10px] text-muted-foreground mb-1 hidden lg:block">Account Value</p>
            <p className="font-bold text-sm hidden lg:block">{formatCurrency(portfolio.equity)}</p>
            <p className="text-xs hidden lg:flex items-center gap-1 mt-0.5">
              <span className={pnlPositive ? "text-bullish" : "text-bearish"}>
                {pnlPositive ? "+" : ""}{formatCurrency(portfolio.todayPnl)} today
              </span>
            </p>
            <div className="lg:hidden flex justify-center">
              <Briefcase className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Top Bar */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-border/40 bg-background/90 backdrop-blur shrink-0">

          {/* Symbol Search */}
          <div className="relative">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 h-9 px-3 rounded-xl border border-border bg-muted/50 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all min-w-[160px] lg:min-w-[220px]"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="font-mono font-medium text-foreground/80">{selectedSymbol}</span>
              <span className="text-xs ml-auto opacity-50">search</span>
            </button>

            <AnimatePresence>
              {searchOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSearchOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full mt-2 left-0 z-50 w-72 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
                  >
                    <div className="p-3 border-b border-border/50 flex items-center gap-2">
                      <Search className="w-4 h-4 text-muted-foreground" />
                      <input
                        ref={searchRef}
                        value={search}
                        onChange={e => setSearch(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === "Enter" && handleSearch(search)}
                        placeholder="Type symbol... (e.g. AAPL)"
                        className="flex-1 bg-transparent text-sm focus:outline-none font-mono"
                      />
                      {search && <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
                    </div>
                    <div className="p-2">
                      <p className="text-[10px] text-muted-foreground px-2 mb-1.5">{search ? "Matching symbols" : "Popular"}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {filteredSuggestions.map(sym => {
                          const mover = [...(movers?.gainers ?? []), ...(movers?.losers ?? [])].find(m => m.symbol === sym);
                          return (
                            <button
                              key={sym}
                              onClick={() => handleSearch(sym)}
                              className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-muted text-sm transition-colors text-left"
                            >
                              <span className="font-mono font-semibold">{sym}</span>
                              {mover && (
                                <span className={cn("text-xs font-mono", mover.changePercent >= 0 ? "text-bullish" : "text-bearish")}>
                                  {mover.changePercent >= 0 ? "+" : ""}{mover.changePercent.toFixed(1)}%
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Right: quick stats */}
          <div className="flex items-center gap-3">
            {movers?.gainers?.[0] && (
              <div className="hidden md:flex items-center gap-1.5 text-xs">
                <TrendingUp className="w-3.5 h-3.5 text-bullish" />
                <span className="font-mono font-semibold text-bullish">{movers.gainers[0].symbol} +{movers.gainers[0].changePercent.toFixed(1)}%</span>
              </div>
            )}
            {movers?.losers?.[0] && (
              <div className="hidden md:flex items-center gap-1.5 text-xs">
                <TrendingDown className="w-3.5 h-3.5 text-bearish" />
                <span className="font-mono font-semibold text-bearish">{movers.losers[0].symbol} {movers.losers[0].changePercent.toFixed(1)}%</span>
              </div>
            )}
            <Link href="/autopilot">
              <button className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-semibold hover:bg-primary/20 transition-all">
                <Sparkles className="w-3.5 h-3.5" /> AI Pilot
              </button>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
