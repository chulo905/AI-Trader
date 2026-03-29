import React, { useState } from "react";
import { useGetMarketMovers, useGetWatchlists, useGetMarketQuotes, useCreateWatchlist, useAddWatchlistSymbol, useRemoveWatchlistSymbol, useGetTradeIdeas } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent, PriceChange, PageTransition, Skeleton, ErrorPanel, Btn, SignalBadge, Table } from "@/components/terminal-ui";
import { formatPrice, formatNumber } from "@/lib/utils";
import { useAppState } from "@/hooks/use-app-state";
import { Compass, TrendingUp, TrendingDown, Zap, Plus, Trash2, Star, Lightbulb, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type Tab = "Movers" | "Watchlist" | "AI Ideas";

export default function DiscoverPage() {
  const { selectedSymbol, setSelectedSymbol } = useAppState();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("Movers");
  const [addInput, setAddInput] = useState("");

  const { data: movers, isLoading: loadingMovers, error: moversError } = useGetMarketMovers({ query: { retry: false } });
  const { data: watchlists } = useGetWatchlists({ query: { retry: false } });
  const { data: ideas, isLoading: loadingIdeas } = useGetTradeIdeas({ limit: 12 });

  const activeList = watchlists?.[0];
  const { data: quotes, isLoading: loadingQuotes } = useGetMarketQuotes(
    { symbols: activeList?.symbols?.join(",") || "" },
    { query: { enabled: !!activeList?.symbols?.length, refetchInterval: 15000 } }
  );

  const createMutation = useCreateWatchlist({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] }) } });
  const addMutation = useAddWatchlistSymbol({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] }); setAddInput(""); } } });
  const removeMutation = useRemoveWatchlistSymbol({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] }) } });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = addInput.trim().toUpperCase();
    if (!sym || !activeList) return;
    if (activeList.symbols.includes(sym)) { setAddInput(""); return; }
    addMutation.mutate({ id: activeList.id, data: { symbol: sym } });
  };

  const handleAddCurrent = () => {
    if (!selectedSymbol || !activeList || activeList.symbols.includes(selectedSymbol)) return;
    addMutation.mutate({ id: activeList.id, data: { symbol: selectedSymbol } });
  };

  const ensureWatchlist = () => {
    if (!watchlists?.length) {
      createMutation.mutate({ data: { name: "My Watchlist", symbols: [] } });
    }
  };

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-2">
        <Compass className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">Discover</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/50 pb-0">
        {(["Movers", "Watchlist", "AI Ideas"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px",
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "AI Ideas" && <Lightbulb className="w-3.5 h-3.5 inline mr-1.5" />}
            {t}
          </button>
        ))}
      </div>

      {/* Market Movers */}
      {tab === "Movers" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <MoverSection
            title="Top Gainers"
            icon={<TrendingUp className="w-4 h-4 text-bullish" />}
            items={movers?.gainers ?? []}
            loading={loadingMovers}
            error={moversError}
            onSelect={(sym) => setSelectedSymbol(sym)}
          />
          <MoverSection
            title="Top Losers"
            icon={<TrendingDown className="w-4 h-4 text-bearish" />}
            items={movers?.losers ?? []}
            loading={loadingMovers}
            error={moversError}
            onSelect={(sym) => setSelectedSymbol(sym)}
          />
          <MoverSection
            title="Most Active"
            icon={<Zap className="w-4 h-4 text-warning" />}
            items={movers?.mostActive ?? []}
            loading={loadingMovers}
            error={moversError}
            onSelect={(sym) => setSelectedSymbol(sym)}
            showVolume
          />
        </div>
      )}

      {/* Watchlist */}
      {tab === "Watchlist" && (
        <Card>
          <CardHeader>
            <CardTitle>{activeList?.name || "My Watchlist"}</CardTitle>
            <div className="flex items-center gap-2">
              {activeList && selectedSymbol && !activeList.symbols.includes(selectedSymbol) && (
                <Btn variant="outline" size="sm" onClick={handleAddCurrent} disabled={addMutation.isPending}>
                  <Star className="w-3 h-3" /> Watch {selectedSymbol}
                </Btn>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!watchlists?.length ? (
              <div className="py-8 text-center">
                <Star className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No watchlist yet.</p>
                <Btn variant="primary" size="sm" onClick={ensureWatchlist}>Create Watchlist</Btn>
              </div>
            ) : (
              <>
                <form onSubmit={handleAdd} className="flex gap-2 mb-4">
                  <input
                    value={addInput}
                    onChange={e => setAddInput(e.target.value.toUpperCase())}
                    placeholder="Add symbol (e.g. NVDA)"
                    className="flex-1 h-9 rounded-sm border border-border bg-muted/40 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                  />
                  <Btn type="submit" size="sm" disabled={addMutation.isPending || !addInput}>
                    <Plus className="w-4 h-4" /> Add
                  </Btn>
                </form>

                {!activeList?.symbols.length ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Add symbols to track them here.</p>
                ) : loadingQuotes ? (
                  <Skeleton className="h-48" />
                ) : (
                  <Table headers={["Symbol", "Price", "Change", "Volume", "AI Signal", ""]}>
                    {quotes?.map(q => (
                      <tr key={q.symbol} className="hover:bg-muted/30 cursor-pointer group" onClick={() => setSelectedSymbol(q.symbol)}>
                        <td className="px-4 py-3 first:pl-5">
                          <span className="font-mono font-bold">{q.symbol}</span>
                          <p className="text-xs text-muted-foreground">{q.name}</p>
                        </td>
                        <td className="px-4 py-3 font-mono">{formatPrice(q.price)}</td>
                        <td className="px-4 py-3"><PriceChange value={q.changePercent} /></td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{formatNumber(q.volume)}</td>
                        <td className="px-4 py-3"><SignalBadge signal={q.signal} /></td>
                        <td className="px-4 py-3 last:pr-5 text-right">
                          <button
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-bearish transition-all"
                            onClick={e => { e.stopPropagation(); if (activeList) removeMutation.mutate({ id: activeList.id, symbol: q.symbol }); }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </Table>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Trade Ideas */}
      {tab === "AI Ideas" && (
        loadingIdeas ? <Skeleton className="h-96" /> :
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ideas?.map(idea => (
            <Card key={idea.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="flex flex-col gap-3 pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl font-bold font-mono">{idea.symbol}</p>
                    <p className="text-xs text-muted-foreground">{new Date(idea.generatedAt).toLocaleTimeString()}</p>
                  </div>
                  <SignalBadge signal={idea.side} />
                </div>

                <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3">{idea.rationale}</p>

                <div className="grid grid-cols-3 gap-2 p-3 rounded-sm bg-muted/40 border border-border/40 text-xs">
                  <div>
                    <p className="text-muted-foreground/70 mb-0.5">Entry</p>
                    <p className="font-mono font-semibold text-xs">{idea.entryZone}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground/70 mb-0.5">Target</p>
                    <p className="font-mono font-semibold text-xs text-bullish">{idea.targetZone}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground/70 mb-0.5">Stop</p>
                    <p className="font-mono font-semibold text-xs text-bearish">{idea.stopZone}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Confidence: <span className="text-foreground font-medium">{idea.confidence}%</span></span>
                  <Link href="/autopilot">
                    <Btn variant="outline" size="sm" onClick={() => setSelectedSymbol(idea.symbol)}>
                      AI Pilot <ArrowRight className="w-3 h-3" />
                    </Btn>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
          {!ideas?.length && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              <Lightbulb className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>No AI ideas right now. Check back soon.</p>
            </div>
          )}
        </div>
      )}
    </PageTransition>
  );
}

function MoverSection({ title, icon, items, loading, error, onSelect, showVolume }: {
  title: string; icon: React.ReactNode;
  items: Array<{ symbol: string; name: string; price: number; changePercent: number; volume: number }>;
  loading: boolean; error: unknown;
  onSelect: (s: string) => void;
  showVolume?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {error ? <ErrorPanel error={error} /> : loading ? <Skeleton className="h-48" /> : (
          <div className="flex flex-col gap-1">
            {items.slice(0, 6).map(q => (
              <Link key={q.symbol} href="/autopilot" onClick={() => onSelect(q.symbol)}>
                <div className="flex items-center justify-between px-2 py-2.5 rounded-sm hover:bg-muted/50 cursor-pointer transition-colors group">
                  <div>
                    <p className="font-mono font-bold text-sm group-hover:text-primary transition-colors">{q.symbol}</p>
                    {showVolume
                      ? <p className="text-[11px] text-muted-foreground">Vol {formatNumber(q.volume)}</p>
                      : <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">{q.name}</p>
                    }
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono">{formatPrice(q.price)}</p>
                    <PriceChange value={q.changePercent} className="text-xs" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
