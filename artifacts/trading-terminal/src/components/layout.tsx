import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAppState } from "@/hooks/use-app-state";
import { useGetPortfolio, useGetMarketMovers } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import {
  LayoutDashboard, Sparkles, LineChart, Compass, Briefcase,
  Settings, Search, X, TrendingUp, TrendingDown,
  Bot, Shield, FlaskConical, Newspaper, Cable, Bell, ChevronDown, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const POPULAR = ["AAPL","NVDA","MSFT","TSLA","META","GOOGL","AMZN","AMD","SPY","BTC","ETH","SOL"];

type NavItem = { path: string; label: string; icon: React.ElementType; desc: string; highlight?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Trading",
    items: [
      { path: "/",          label: "Home",        icon: LayoutDashboard, desc: "Market overview" },
      { path: "/autopilot", label: "AI Pilot",    icon: Sparkles,        desc: "AI trading decisions", highlight: true },
      { path: "/autonomous", label: "Auto Loop",  icon: Bot,             desc: "Autonomous execution" },
      { path: "/chart",     label: "Charts",      icon: LineChart,       desc: "Price charts" },
      { path: "/portfolio", label: "Portfolio",   icon: Briefcase,       desc: "Positions & P&L" },
    ],
  },
  {
    label: "Research",
    items: [
      { path: "/sentiment", label: "Sentiment",   icon: Newspaper,       desc: "News & sentiment" },
      { path: "/discover",  label: "Discover",    icon: Compass,         desc: "Find opportunities" },
      { path: "/backtest",  label: "Backtest",    icon: FlaskConical,    desc: "Test strategies" },
    ],
  },
  {
    label: "System",
    items: [
      { path: "/risk",      label: "Risk",        icon: Shield,          desc: "Risk management" },
      { path: "/brokerage", label: "Brokerage",   icon: Cable,           desc: "Live integration" },
      { path: "/alerts",    label: "Alerts",      icon: Bell,            desc: "Price alerts" },
      { path: "/settings",  label: "Settings",    icon: Settings,        desc: "Preferences" },
    ],
  },
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

  const isActive = (path: string) => location === path || (path !== "/" && location.startsWith(path));

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* Sidebar */}
      <aside className="w-[60px] lg:w-56 border-r border-border/50 flex flex-col shrink-0 bg-card/40 overflow-y-auto">

        {/* Logo */}
        <div className="h-14 flex items-center justify-center lg:justify-start lg:px-4 border-b border-border/40 shrink-0">
          <div className="w-7 h-7 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div className="hidden lg:block ml-2.5">
            <p className="font-bold text-sm tracking-tight leading-none">AI Trader</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Paper trading only</p>
          </div>
        </div>

        {/* Nav Groups */}
        <nav className="flex-1 py-3 flex flex-col gap-0.5 px-1.5">
          {navGroups.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div className="my-2 border-t border-border/30" />}
              <p className="hidden lg:block text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest px-2 py-1">{group.label}</p>
              {group.items.map(item => {
                const active = isActive(item.path);
                const Icon = item.icon;
                return (
                  <Link key={item.path} href={item.path}>
                    <div className={cn(
                      "relative flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-150 group cursor-pointer",
                      active
                        ? item.highlight ? "bg-primary/15 text-primary" : "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}>
                      {active && <motion.div layoutId="nav-pill" className={cn("absolute inset-0 rounded-xl", item.highlight ? "bg-primary/10 border border-primary/20" : "bg-muted")} style={{ zIndex: -1 }} />}
                      <Icon className={cn("w-4 h-4 shrink-0", active && item.highlight && "text-primary", active && !item.highlight && "text-foreground")} />
                      <div className="hidden lg:block min-w-0 flex-1">
                        <p className={cn("text-xs font-medium leading-none truncate", item.highlight && active && "text-primary")}>{item.label}</p>
                        {!active && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{item.desc}</p>}
                      </div>
                      {item.highlight && !active && (
                        <span className="hidden lg:block ml-auto text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md border border-primary/20">AI</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Portfolio mini */}
        {portfolio && (
          <div className="m-2 p-2.5 rounded-xl border border-border/50 bg-muted/30 shrink-0">
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
        <header className="h-14 flex items-center justify-between px-4 lg:px-5 border-b border-border/40 bg-background/90 backdrop-blur shrink-0">

          {/* Symbol Search */}
          <div className="relative">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 h-8 px-3 rounded-xl border border-border bg-muted/50 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all min-w-[140px] lg:min-w-[200px]"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="font-mono font-medium text-foreground/80 text-xs">{selectedSymbol}</span>
              <span className="text-xs ml-auto opacity-50 hidden lg:block">search</span>
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
                              <span className="font-mono font-semibold text-xs">{sym}</span>
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

          {/* Right: quick stats + AI Pilot */}
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
              <button className="flex items-center gap-1.5 h-7 px-3 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-semibold hover:bg-primary/20 transition-all">
                <Sparkles className="w-3 h-3" /> AI Pilot
              </button>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1400px] mx-auto p-4 md:p-5 lg:p-6 h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
