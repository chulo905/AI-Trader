import { useGetMarketMovers, useGetPositions, useGetTradeIdeas } from "@workspace/api-client-react";
import { TerminalCard, PageTransition, TerminalSkeleton, ErrorPanel, PriceChange, SignalBadge, TerminalTable, TerminalButton } from "@/components/terminal-ui";
import { formatCurrency, formatPrice } from "@/lib/utils";
import { useAppState } from "@/hooks/use-app-state";
import { Link } from "wouter";

export default function Dashboard() {
  const { setSelectedSymbol } = useAppState();
  const { data: movers, isLoading: loadingMovers, error: errorMovers } = useGetMarketMovers({ query: { retry: false } });
  const { data: ideas, isLoading: loadingIdeas } = useGetTradeIdeas({ limit: 4 }, { query: { retry: false } });
  const { data: positions, isLoading: loadingPositions } = useGetPositions({ query: { retry: false } });

  return (
    <PageTransition>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold tracking-tight">Market Overview</h1>
      </div>

      {/* Top Row: Market Movers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TerminalCard title="Top Gainers">
          {errorMovers ? <ErrorPanel error={errorMovers} /> : loadingMovers ? <TerminalSkeleton className="h-40" /> : (
            <div className="flex flex-col gap-3">
              {movers?.gainers.slice(0, 4).map(q => (
                <div key={q.symbol} className="flex justify-between items-center group cursor-pointer hover:bg-muted/50 p-2 rounded-lg -mx-2 transition-colors" onClick={() => setSelectedSymbol(q.symbol)}>
                  <div className="flex flex-col">
                    <span className="font-bold font-mono">{q.symbol}</span>
                    <span className="text-xs text-muted-foreground truncate w-24">{q.name}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-mono">{formatPrice(q.price)}</span>
                    <PriceChange value={q.changePercent} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TerminalCard>

        <TerminalCard title="Top Losers">
          {errorMovers ? <ErrorPanel error={errorMovers} /> : loadingMovers ? <TerminalSkeleton className="h-40" /> : (
            <div className="flex flex-col gap-3">
              {movers?.losers.slice(0, 4).map(q => (
                <div key={q.symbol} className="flex justify-between items-center group cursor-pointer hover:bg-muted/50 p-2 rounded-lg -mx-2 transition-colors" onClick={() => setSelectedSymbol(q.symbol)}>
                  <div className="flex flex-col">
                    <span className="font-bold font-mono">{q.symbol}</span>
                    <span className="text-xs text-muted-foreground truncate w-24">{q.name}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-mono">{formatPrice(q.price)}</span>
                    <PriceChange value={q.changePercent} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TerminalCard>

        <TerminalCard title="Most Active">
          {errorMovers ? <ErrorPanel error={errorMovers} /> : loadingMovers ? <TerminalSkeleton className="h-40" /> : (
            <div className="flex flex-col gap-3">
              {movers?.mostActive.slice(0, 4).map(q => (
                <div key={q.symbol} className="flex justify-between items-center group cursor-pointer hover:bg-muted/50 p-2 rounded-lg -mx-2 transition-colors" onClick={() => setSelectedSymbol(q.symbol)}>
                  <div className="flex flex-col">
                    <span className="font-bold font-mono">{q.symbol}</span>
                    <span className="text-xs text-muted-foreground truncate w-24">Vol: {(q.volume/1e6).toFixed(1)}M</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-mono">{formatPrice(q.price)}</span>
                    <PriceChange value={q.changePercent} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TerminalCard>
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
        <TerminalCard 
          title="Active AI Trade Ideas" 
          action={<Link href="/ideas" className="text-xs text-primary hover:underline">View All</Link>}
        >
          {loadingIdeas ? <TerminalSkeleton className="h-64" /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ideas?.slice(0, 4).map(idea => (
                <div key={idea.id} className="border border-border/50 bg-background/50 rounded-lg p-4 hover:border-primary/30 transition-all cursor-pointer" onClick={() => setSelectedSymbol(idea.symbol)}>
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-bold text-lg font-mono">{idea.symbol}</span>
                    <SignalBadge signal={idea.side} />
                  </div>
                  <div className="text-xs text-muted-foreground mb-3 line-clamp-2">{idea.rationale}</div>
                  <div className="flex justify-between text-xs font-mono">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground/70">ENTRY</span>
                      <span className="text-foreground">{idea.entryZone}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-muted-foreground/70">TARGET</span>
                      <span className="text-primary">{idea.targetZone}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TerminalCard>

        <TerminalCard 
          title="Open Positions"
          action={<Link href="/portfolio" className="text-xs text-primary hover:underline">Manage</Link>}
        >
          {loadingPositions ? <TerminalSkeleton className="h-64" /> : (
            <TerminalTable headers={["Symbol", "Side", "Entry", "Current", "P&L"]}>
              {positions?.slice(0, 5).map(pos => (
                <tr key={pos.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedSymbol(pos.symbol)}>
                  <td className="px-4 py-3 font-bold font-mono">{pos.symbol}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold uppercase ${pos.side === 'long' ? 'text-bullish' : 'text-bearish'}`}>{pos.side}</span>
                  </td>
                  <td className="px-4 py-3 font-mono">{formatPrice(pos.entryPrice)}</td>
                  <td className="px-4 py-3 font-mono">{formatPrice(pos.currentPrice)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end">
                      <span className={`font-mono ${pos.unrealizedPnl >= 0 ? "text-bullish" : "text-bearish"}`}>
                        {formatCurrency(pos.unrealizedPnl)}
                      </span>
                      <PriceChange value={pos.unrealizedPnlPercent} className="text-xs" />
                    </div>
                  </td>
                </tr>
              ))}
              {!positions?.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No open positions.</td>
                </tr>
              )}
            </TerminalTable>
          )}
        </TerminalCard>
      </div>
    </PageTransition>
  );
}
