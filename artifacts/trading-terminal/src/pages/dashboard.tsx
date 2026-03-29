import { useGetMarketMovers, useGetPositions, useGetPortfolio, useGetTradeStats } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent, StatCard, PriceChange, PageTransition, Skeleton, ErrorPanel, Btn, SignalBadge } from "@/components/terminal-ui";
import { formatCurrency, formatPrice } from "@/lib/utils";
import { useAppState } from "@/hooks/use-app-state";
import { Link } from "wouter";
import { Sparkles, TrendingUp, TrendingDown, Activity, ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_SYMBOLS = ["AAPL", "NVDA", "TSLA", "MSFT", "META", "AMD", "SPY", "BTC"];

export default function Dashboard() {
  const { setSelectedSymbol } = useAppState();
  const { data: movers, isLoading: loadingMovers, error: moversError } = useGetMarketMovers({ query: { retry: false } });
  const { data: positionsData } = useGetPositions({ query: { retry: false } });
  const positions = Array.isArray((positionsData as any)?.positions) ? (positionsData as any).positions : Array.isArray(positionsData) ? positionsData : [];
  const { data: portfolio } = useGetPortfolio({ query: { retry: false } });
  const { data: stats } = useGetTradeStats({ query: { retry: false } });

  return (
    <PageTransition>
      {/* Portfolio Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Account Value"
          value={formatCurrency(portfolio?.equity ?? 100000)}
          sub="Starting: $100,000"
        />
        <StatCard
          label="Today's Gain/Loss"
          value={`${(portfolio?.todayPnl ?? 0) >= 0 ? "+" : ""}${formatCurrency(portfolio?.todayPnl ?? 0)}`}
          valueClass={(portfolio?.todayPnl ?? 0) >= 0 ? "text-bullish" : "text-bearish"}
        />
        <StatCard
          label="Total Profit"
          value={`${(portfolio?.totalPnl ?? 0) >= 0 ? "+" : ""}${formatCurrency(portfolio?.totalPnl ?? 0)}`}
          valueClass={(portfolio?.totalPnl ?? 0) >= 0 ? "text-bullish" : "text-bearish"}
        />
        <StatCard
          label="Win Rate"
          value={stats ? `${stats.winRate}%` : "—"}
          sub={stats ? `${stats.winCount}W / ${stats.lossCount}L` : "No trades yet"}
        />
      </div>

      {/* AI Pilot CTA */}
      <Link href="/autopilot">
        <div className="cursor-pointer group flex items-center justify-between p-5 border border-border hover:border-foreground/25 bg-card hover:bg-muted/60 transition-all rounded-sm">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 border border-border flex items-center justify-center rounded-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm tracking-tight">AI Pilot — Let AI Trade For You</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pick any stock or crypto. The AI analyzes everything and decides BUY/SELL/HOLD automatically.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-xs text-muted-foreground shrink-0 group-hover:text-foreground transition-colors">
            <span className="hidden sm:block uppercase tracking-wider">Get started</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Market Movers */}
        <Card>
          <CardHeader>
            <CardTitle>Market Movers</CardTitle>
            <Link href="/discover" className="text-[10px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors">See all →</Link>
          </CardHeader>
          <CardContent className="p-0">
            {moversError ? (
              <div className="p-5"><ErrorPanel error={moversError} /></div>
            ) : loadingMovers ? (
              <div className="p-5"><Skeleton className="h-40" /></div>
            ) : (
              <div>
                <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                  <div className="px-5 py-2.5 text-[10px] font-bold text-bullish uppercase tracking-widest flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" /> Gainers
                  </div>
                  <div className="px-5 py-2.5 text-[10px] font-bold text-bearish uppercase tracking-widest flex items-center gap-1.5">
                    <TrendingDown className="w-3 h-3" /> Losers
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-border">
                  <div className="divide-y divide-border/50">
                    {movers?.gainers.slice(0, 4).map(q => (
                      <SymbolRow key={q.symbol} symbol={q.symbol} price={q.price} change={q.changePercent} onClick={() => setSelectedSymbol(q.symbol)} />
                    ))}
                  </div>
                  <div className="divide-y divide-border/50">
                    {movers?.losers.slice(0, 4).map(q => (
                      <SymbolRow key={q.symbol} symbol={q.symbol} price={q.price} change={q.changePercent} onClick={() => setSelectedSymbol(q.symbol)} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open Positions */}
        <Card>
          <CardHeader>
            <CardTitle>Open Positions</CardTitle>
            <Link href="/portfolio" className="text-[10px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors">Manage →</Link>
          </CardHeader>
          <CardContent className="p-0">
            {!positions?.length ? (
              <div className="py-10 text-center px-5">
                <Activity className="w-7 h-7 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No open positions yet.</p>
                <Link href="/autopilot">
                  <Btn variant="primary" size="sm">
                    <Sparkles className="w-3 h-3" /> Start with AI Pilot
                  </Btn>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {positions.slice(0, 5).map(pos => (
                  <div
                    key={pos.id}
                    className="flex items-center justify-between py-3 px-5 hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => setSelectedSymbol(pos.symbol)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 border border-border flex items-center justify-center rounded-sm">
                        <span className="text-[10px] font-bold font-mono">{pos.symbol.slice(0, 2)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold font-mono">{pos.symbol}</p>
                        <p className="text-[11px] text-muted-foreground">{pos.shares} shares</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-bold font-mono tabular-nums", pos.unrealizedPnl >= 0 ? "text-bullish" : "text-bearish")}>
                        {pos.unrealizedPnl >= 0 ? "+" : ""}{formatCurrency(pos.unrealizedPnl)}
                      </p>
                      <PriceChange value={pos.unrealizedPnlPercent} className="text-xs" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick AI Scan */}
      <Card>
        <CardHeader>
          <CardTitle>Quick AI Scan</CardTitle>
          <span className="text-[10px] text-muted-foreground">Click any symbol to run AI Pilot</span>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {QUICK_SYMBOLS.map(sym => {
              const mover = [...(movers?.gainers ?? []), ...(movers?.losers ?? []), ...(movers?.mostActive ?? [])].find(m => m.symbol === sym);
              return (
                <Link key={sym} href="/autopilot" onClick={() => setSelectedSymbol(sym)}>
                  <div className="flex flex-col items-center gap-1.5 p-3 border border-border hover:border-foreground/25 hover:bg-muted cursor-pointer transition-all group rounded-sm">
                    <span className="font-mono font-bold text-xs group-hover:text-foreground transition-colors">{sym}</span>
                    {mover ? (
                      <PriceChange value={mover.changePercent} className="text-[11px]" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-muted-foreground/30" />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </PageTransition>
  );
}

function SymbolRow({ symbol, price, change, onClick }: { symbol: string; price: number; change: number; onClick: () => void }) {
  return (
    <Link href="/autopilot" onClick={onClick}>
      <div className="flex items-center justify-between py-2.5 px-5 hover:bg-muted/40 cursor-pointer transition-colors">
        <span className="font-mono font-bold text-xs">{symbol}</span>
        <div className="text-right">
          <p className="text-[11px] font-mono text-muted-foreground tabular-nums">{formatPrice(price)}</p>
          <PriceChange value={change} className="text-[11px]" />
        </div>
      </div>
    </Link>
  );
}
