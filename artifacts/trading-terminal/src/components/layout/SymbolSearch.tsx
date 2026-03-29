import React, { useState, useRef, useEffect } from "react";
import { useGetMarketMovers } from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const POPULAR = ["AAPL","NVDA","MSFT","TSLA","META","GOOGL","AMZN","AMD","SPY","BTC","ETH","SOL"];

export function SymbolSearch() {
  const { selectedSymbol, setSelectedSymbol } = useAppState();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { data: movers } = useGetMarketMovers({ query: { retry: false, staleTime: 60000 } });

  const filteredSuggestions = search.length > 0
    ? POPULAR.filter(s => s.includes(search.toUpperCase())).slice(0, 6)
    : POPULAR.slice(0, 8);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searchOpen]);

  const handleSearch = (sym: string) => {
    if (!sym.trim()) return;
    setSelectedSymbol(sym.trim().toUpperCase());
    setSearch("");
    setSearchOpen(false);
  };

  return (
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
                <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest px-2 py-1">
                  {search ? "Matching" : "Popular"}
                </p>
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
  );
}
