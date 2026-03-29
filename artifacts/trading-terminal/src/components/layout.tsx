import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAppState } from "@/hooks/use-app-state";
import { useGetPortfolio, useGetMarketMovers } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import {
  LayoutDashboard, Sparkles, LineChart, Compass, Briefcase,
  Settings, Search, X, TrendingUp, TrendingDown,
  Bot, Shield, FlaskConical, Newspaper, Cable, Bell, ChevronRight
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
      { path: "/",          label: "Home",       icon: LayoutDashboard, desc: "Market overview" },
      { path: "/autopilot", label: "AI Pilot",   icon: Sparkles,        desc: "AI trading decisions", highlight: true },
      { path: "/autonomous",label: "Auto Loop",  icon: Bot,             desc: "Autonomous execution" },
      { path: "/chart",     label: "Charts",     icon: LineChart,       desc: "Price charts" },
      { path: "/portfolio", label: "Portfolio",  icon: Briefcase,       desc: "Positions & P&L" },
    ],
  },
  {
    label: "Research",
    items: [
      { path: "/sentiment", label: "Sentiment",  icon: Newspaper,       desc: "News & sentiment" },
      { path: "/discover",  label: "Discover",   icon: Compass,         desc: "Find opportunities" },
      { path: "/backtest",  label: "Backtest",   icon: FlaskConical,    desc: "Test strategies" },
    ],
  },
  {
    label: "System",
    items: [
      { path: "/risk",      label: "Risk",       icon: Shield,          desc: "Risk management" },
      { path: "/brokerage", label: "Brokerage",  icon: Cable,           desc: "Live integration" },
      { path: "/alerts",    label: "Alerts",     icon: Bell,            desc: "Price alerts" },
      { path: "/settings",  label: "Settings",   icon: Settings,        desc: "Preferences" },
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
  const { data: movers }    = useGetMarketMovers({ query: { retry: false, staleTime: 60000 } });

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
      <aside className="w-[52px] lg:w-52 border-r border-border flex flex-col shrink-0 bg-card overflow-y-auto">

        {/* Logo */}
        <div className="h-12 flex items-center justify-center lg:justify-start lg:px-4 border-b border-border shrink-0">
          <div className="w-6 h-6 bg-primary flex items-center justify-center shrink-0 rounded-sm">
            <Sparkles className="w-3 h-3 text-primary-foreground" />
          </div>
          <div className="hidden lg:block ml-2.5">
            <p className="font-bold text-sm tracking-tight leading-none">AI Trader</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">Paper trading only</p>
          </div>
        </div>

        {/* Nav Groups */}
        <nav className="flex-1 py-2 flex flex-col px-1.5">
          {navGroups.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div className="my-2 border-t border-border" />}
              <p className="hidden lg:block text-[9px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em] px-2.5 py-1.5">{group.label}</p>
              {group.items.map(item => {
                const active = isActive(item.path);
                const Icon = item.icon;
                return (
                  <Link key={item.path} href={item.path}>
                    <div className={cn(
                      "relative flex items-center gap-2.5 px-2.5 py-2 rounded-sm transition-all duration-100 cursor-pointer group",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}>
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <div className="hidden lg:block min-w-0 flex-1">
                        <p className="text-xs font-medium leading-none truncate">{item.label}</p>
                        {!active && <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{item.desc}</p>}
                      </div>
                      {item.highlight && !active && (
                        <span className="hidden lg:block ml-auto text-[9px] font-bold bg-foreground/8 text-foreground/60 px-1.5 py-0.5 rounded-sm border border-border">AI</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Portfolio mini strip */}
        {portfolio && (
          <div className="mx-1.5 mb-1.5 p-2.5 border border-border rounded-sm shrink-0">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1 hidden lg:block">Account</p>
            <p className="font-bold text-sm font-mono hidden lg:block tabular-nums">{formatCurrency(portfolio.equity)}</p>
            <p className={cn("text-xs font-mono hidden lg:block tabular-nums mt-0.5", pnlPositive ? "text-bullish" : "text-bearish")}>
              {pnlPositive ? "+" : ""}{formatCurrency(portfolio.todayPnl)} today
            </p>
            <div className="lg:hidden flex justify-center">
              <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Top Bar */}
        <header className="h-12 flex items-center justify-between px-4 lg:px-5 border-b border-border bg-card shrink-0">

          {/* Symbol Search */}
          <div className="relative">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 h-7 px-3 rounded-sm border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all min-w-[140px] lg:min-w-[180px]"
            >
              <Search className="w-3 h-3" />
              <span className="font-mono font-semibold text-foreground/90">{selectedSymbol}</span>
              <span className="ml-auto opacity-40 hidden lg:block">search</span>
            </button>

            <AnimatePresence>
              {searchOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSearchOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full mt-1.5 left-0 z-50 w-64 bg-card border border-border rounded-sm shadow-2xl overflow-hidden"
                  >
                    <div className="p-2.5 border-b border-border flex items-center gap-2">
                      <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <input
                        ref={searchRef}
                        value={search}
                        onChange={e => setSearch(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === "Enter" && handleSearch(search)}
                        placeholder="Symbol (e.g. AAPL)"
                        className="flex-1 bg-transparent text-sm focus:outline-none font-mono"
                      />
                      {search && (
                        <button onClick={() => setSearch("")}>
                          <X className="w-3 h-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                    <div className="p-1.5">
                      <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest px-2 py-1">{search ? "Matching" : "Popular"}</p>
                      <div className="grid grid-cols-2 gap-0.5">
                        {filteredSuggestions.map(sym => {
                          const mover = [...(movers?.gainers ?? []), ...(movers?.losers ?? [])].find(m => m.symbol === sym);
                          return (
                            <button
                              key={sym}
                              onClick={() => handleSearch(sym)}
                              className="flex items-center justify-between px-3 py-2 rounded-sm hover:bg-muted text-sm transition-colors"
                            >
                              <span className="font-mono font-bold text-xs">{sym}</span>
                              {mover && (
                                <span className={cn("text-[11px] font-mono font-semibold tabular-nums", mover.changePercent >= 0 ? "text-bullish" : "text-bearish")}>
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

          {/* Right: market pulse + AI Pilot */}
          <div className="flex items-center gap-4">
            {(() => { const g = movers?.gainers?.find(x => x.changePercent > 0); return g ? (
              <div className="hidden md:flex items-center gap-1.5 text-xs">
                <span className="text-bullish/40">▲</span>
                <span className="font-mono font-semibold text-bullish tabular-nums">
                  {g.symbol} +{g.changePercent.toFixed(1)}%
                </span>
              </div>
            ) : null; })()}
            {(() => { const l = movers?.losers?.find(x => x.changePercent < 0); return l ? (
              <div className="hidden md:flex items-center gap-1.5 text-xs">
                <span className="text-bearish/40">▼</span>
                <span className="font-mono font-semibold text-bearish tabular-nums">
                  {l.symbol} {l.changePercent.toFixed(1)}%
                </span>
              </div>
            ) : null; })()}
            <div className="w-px h-4 bg-border hidden md:block" />
            <Link href="/autopilot">
              <button className="flex items-center gap-1.5 h-7 px-3 rounded-sm bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-all">
                <Sparkles className="w-3 h-3" /> AI Pilot
              </button>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1440px] mx-auto p-4 md:p-5 lg:p-6 h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
