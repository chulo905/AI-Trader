import React, { useState } from "react";
import { useGetWatchlists, useGetMarketQuotes, useCreateWatchlist, useRemoveWatchlistSymbol, useAddWatchlistSymbol } from "@workspace/api-client-react";
import { TerminalCard, PageTransition, TerminalSkeleton, ErrorPanel, PriceChange, SignalBadge, TerminalTable, TerminalButton, TerminalInput } from "@/components/terminal-ui";
import { formatPrice, formatNumber } from "@/lib/utils";
import { useAppState } from "@/hooks/use-app-state";
import { Trash2, Plus, List, PlusCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTickerPrice } from "@/hooks/use-ticker-price";
import { cn } from "@/lib/utils";

export default function WatchlistPage() {
  const { selectedSymbol, setSelectedSymbol } = useAppState();
  const queryClient = useQueryClient();
  const { data: watchlists, isLoading: loadingLists, error: errorLists } = useGetWatchlists({ query: { retry: false } });
  const [activeListId, setActiveListId] = useState<number | null>(null);
  
  const activeList = watchlists?.find(w => w.id === activeListId) || watchlists?.[0];
  
  const { data: quotes, isLoading: loadingQuotes } = useGetMarketQuotes(
    { symbols: activeList?.symbols?.join(',') || '' },
    { query: { enabled: !!activeList?.symbols?.length, refetchInterval: 30000 } }
  );

  const createMutation = useCreateWatchlist({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] })
    }
  });

  const addSymbolMutation = useAddWatchlistSymbol({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
        queryClient.invalidateQueries({ queryKey: ['/api/market/quotes'] });
        setAddSymbolInput("");
      }
    }
  });

  const removeSymbolMutation = useRemoveWatchlistSymbol({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
        queryClient.invalidateQueries({ queryKey: ['/api/market/quotes'] });
      }
    }
  });

  const [newListName, setNewListName] = useState("");
  const [addSymbolInput, setAddSymbolInput] = useState("");

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    if (newListName) {
      createMutation.mutate({ data: { name: newListName, symbols: [] } });
      setNewListName("");
    }
  };

  const handleAddSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = addSymbolInput.trim().toUpperCase();
    if (!sym || !activeList) return;
    if (activeList.symbols.includes(sym)) {
      setAddSymbolInput("");
      return;
    }
    addSymbolMutation.mutate({ id: activeList.id, data: { symbol: sym } });
  };

  const handleAddActiveSymbol = () => {
    if (!selectedSymbol || !activeList) return;
    if (activeList.symbols.includes(selectedSymbol)) return;
    addSymbolMutation.mutate({ id: activeList.id, data: { symbol: selectedSymbol } });
  };

  return (
    <PageTransition>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Watchlists</h1>
        {activeList && selectedSymbol && (
          <TerminalButton
            size="sm"
            variant="outline"
            onClick={handleAddActiveSymbol}
            disabled={addSymbolMutation.isPending || activeList.symbols.includes(selectedSymbol)}
            className="flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Add {selectedSymbol} to {activeList.name}
          </TerminalButton>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar: Lists */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <TerminalCard title="Your Lists">
            {errorLists ? <ErrorPanel error={errorLists} /> : loadingLists ? <TerminalSkeleton className="h-40" /> : (
              <div className="flex flex-col gap-2">
                {watchlists?.map(w => (
                  <button 
                    key={w.id} 
                    onClick={() => setActiveListId(w.id)}
                    className={`text-left px-3 py-2 rounded-sm transition-all ${
                      (activeListId === w.id || (!activeListId && watchlists[0]?.id === w.id)) 
                      ? "bg-primary/20 text-primary border border-primary/30" 
                      : "hover:bg-muted text-foreground border border-transparent"
                    }`}
                  >
                    <div className="font-medium">{w.name}</div>
                    <div className="text-xs opacity-70 mt-1">{w.symbols.length} symbols</div>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-6 pt-4 border-t border-border/50">
              <form onSubmit={handleCreateList} className="flex gap-2">
                <TerminalInput 
                  placeholder="New List Name..." 
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="h-8 text-xs"
                />
                <TerminalButton size="sm" type="submit" disabled={createMutation.isPending}>
                  <Plus className="w-4 h-4" />
                </TerminalButton>
              </form>
            </div>
          </TerminalCard>
        </div>

        {/* Right Content: Quotes */}
        <div className="lg:col-span-3">
          <TerminalCard title={activeList?.name || "Watchlist Quotes"}>
            {/* Add Symbol Bar */}
            {activeList && (
              <form onSubmit={handleAddSymbol} className="flex gap-2 mb-4">
                <TerminalInput
                  placeholder="Type symbol to add (e.g. TSLA)"
                  value={addSymbolInput}
                  onChange={e => setAddSymbolInput(e.target.value.toUpperCase())}
                  className="h-9 font-mono uppercase max-w-xs"
                />
                <TerminalButton size="sm" type="submit" disabled={addSymbolMutation.isPending || !addSymbolInput}>
                  <Plus className="w-4 h-4 mr-1" /> Add Symbol
                </TerminalButton>
              </form>
            )}

            {!activeList?.symbols.length ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center border border-dashed border-border/50 rounded-sm">
                <List className="w-12 h-12 mb-4 opacity-20" />
                <p>This watchlist is empty.</p>
                <p className="text-xs mt-2">Type a symbol above or click "Add [SYMBOL]" in the header to add stocks.</p>
              </div>
            ) : loadingQuotes ? (
              <TerminalSkeleton className="h-[500px]" />
            ) : (
              <TerminalTable headers={["Symbol", "Price", "Change", "Volume", "AI Signal", ""]}>
                {quotes?.map(q => (
                  <WatchlistRow
                    key={q.symbol}
                    q={q}
                    onSelect={() => setSelectedSymbol(q.symbol)}
                    onRemove={() => { if(activeList) removeSymbolMutation.mutate({ id: activeList.id, symbol: q.symbol }); }}
                  />
                ))}
              </TerminalTable>
            )}
          </TerminalCard>
        </div>
      </div>
    </PageTransition>
  );
}

interface QuoteData {
  symbol: string;
  name?: string | null;
  price: number;
  changePercent: number;
  volume?: number | null;
  signal?: string | null;
}

function WatchlistRow({ q, onSelect, onRemove }: { q: QuoteData; onSelect: () => void; onRemove: () => void }) {
  const { price: livePrice, changePercent: liveChangePercent, flashDirection } = useTickerPrice(q.symbol);

  const displayPrice = livePrice ?? q.price;
  const displayChange = liveChangePercent ?? q.changePercent;

  return (
    <tr className="hover:bg-muted/40 cursor-pointer group" onClick={onSelect}>
      <td className="px-4 py-4">
        <div className="flex flex-col">
          <span className="font-bold font-mono text-base">{q.symbol}</span>
          <span className="text-xs text-muted-foreground">{q.name}</span>
        </div>
      </td>
      <td className={cn(
        "px-4 py-4 font-mono text-base tabular-nums transition-colors duration-300",
        flashDirection === "up" && "text-bullish",
        flashDirection === "down" && "text-bearish"
      )}>
        {formatPrice(displayPrice)}
      </td>
      <td className="px-4 py-4">
        <PriceChange value={displayChange} />
      </td>
      <td className="px-4 py-4 font-mono text-xs">{q.volume !== undefined ? formatNumber(q.volume) : "—"}</td>
      <td className="px-4 py-4">
        <SignalBadge signal={q.signal} />
      </td>
      <td className="px-4 py-4 text-right">
        <TerminalButton 
          variant="ghost" 
          size="sm" 
          className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="w-4 h-4" />
        </TerminalButton>
      </td>
    </tr>
  );
}
