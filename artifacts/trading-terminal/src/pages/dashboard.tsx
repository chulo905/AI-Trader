import { useGetMarketMovers, useGetPositions, useGetPortfolio, useGetTradeStats } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent, StatCard, PriceChange, PageTransition, Skeleton, ErrorPanel, Btn, SignalBadge } from "@/components/terminal-ui";
import { formatCurrency, formatPrice } from "@/lib/utils";
import { useAppState } from "@/hooks/use-app-state";
import { Link } from "wouter";
import { Sparkles, TrendingUp, TrendingDown, Zap, Activity, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_SYMBOLS = ["AAPL", "NVDA", "TSLA", "MSFT", "META", "AMD", "SPY", "BTC"];

export default function Dashboard() {
  const { setSelectedSymbol } = useAppState();
  const { data: movers, isLoading: loadingMovers, error: moversError } = useGetMarketMovers({ query: { retry: false } });
  const { data: positions } = useGetPositions({ query: { retry: false } });
  const { data: portfolio } = useGetPortfolio({ query: { retry: false } });
  const { data: stats } = useGetTradeStats({ query: { retry: false } });

  return (
    <PageTransition>
      {/* Hero: Portfolio Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Account Value"
          value={formatCurrency(portfolio?.equity ?? 100000)}
          sub="Starting: $100,000"
          valueClass="text-foreground"
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
          valueClass="text-primary"
        />
      </div>

      {/* AI Pilot CTA */}
      <Link href="/autopilot">
        <div className="cursor-pointer group flex items-center justify-between p-5 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/8 to-primary/3 hover:border-primary/40 hover:from-primary/12 transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-bold text-base">AI Pilot — Let AI Trade For You</p>
              <p className="text-sm text-muted-foreground mt-0.5">Pick any stock or crypto. The AI analyzes everything and executes the best trade automatically.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm shrink-0">
            <span className="hidden sm:block">Get started</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Market Movers */}
        <Card>
          <CardHeader>
            <CardTitle>Market Movers Today</CardTitle>
            <Link href="/discover" className="text-xs text-primary hover:underline">See all</Link>
          </CardHeader>
          <CardContent>
            {moversError ? <ErrorPanel error={moversError} /> : loadingMovers ? <Skeleton className="h-48" /> : (
              <div className="flex flex-col gap-1">
                <div className="grid grid-cols-2 gap-1 mb-2">
                  <span className="text-xs text-bullish font-medium flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Top Gainers</span>
                  <span className="text-xs text-bearish font-medium flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Top Losers</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {movers?.gainers.slice(0, 4).map(q => (
                    <SymbolRow key={q.symbol} symbol={q.symbol} price={q.price} change={q.changePercent} onClick={() => setSelectedSymbol(q.symbol)} />
                  ))}
                  {movers?.losers.slice(0, 4).map(q => (
                    <SymbolRow key={q.symbol} symbol={q.symbol} price={q.price} change={q.changePercent} onClick={() => setSelectedSymbol(q.symbol)} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open Positions */}
        <Card>
          <CardHeader>
            <CardTitle>Your Open Positions</CardTitle>
            <Link href="/portfolio" className="text-xs text-primary hover:underline">Manage</Link>
          </CardHeader>
          <CardContent>
            {!positions?.length ? (
              <div className="py-8 text-center">
                <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No open positions yet.</p>
                <Link href="/autopilot">
                  <Btn variant="primary" size="sm" className="mt-3">
                    <Sparkles className="w-3.5 h-3.5" /> Start with AI Pilot
                  </Btn>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {positions.slice(0, 5).map(pos => (
                  <div key={pos.id} className="flex items-center justify-between py-2 px-1 rounded-xl hover:bg-muted/40 cursor-pointer transition-colors" onClick={() => setSelectedSymbol(pos.symbol)}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                        <span className="text-xs font-bold">{pos.symbol.slice(0, 2)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{pos.symbol}</p>
                        <p className="text-xs text-muted-foreground">{pos.shares} shares</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-semibold font-mono", pos.unrealizedPnl >= 0 ? "text-bullish" : "text-bearish")}>
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

      {/* Quick AI Analysis shortcuts */}
      <Card>
        <CardHeader>
          <CardTitle>Quick AI Scan</CardTitle>
          <span className="text-xs text-muted-foreground">Click any symbol to run AI Pilot</span>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {QUICK_SYMBOLS.map(sym => {
              const mover = [...(movers?.gainers ?? []), ...(movers?.losers ?? []), ...(movers?.mostActive ?? [])].find(m => m.symbol === sym);
              return (
                <Link key={sym} href="/autopilot" onClick={() => setSelectedSymbol(sym)}>
                  <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/60 cursor-pointer transition-all group">
                    <span className="font-mono font-bold text-sm group-hover:text-primary transition-colors">{sym}</span>
                    {mover ? (
                      <PriceChange value={mover.changePercent} className="text-xs" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-muted-foreground/40" />
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
      <div className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors group">
        <span className="font-mono font-semibold text-sm group-hover:text-primary transition-colors">{symbol}</span>
        <div className="text-right">
          <p className="text-xs font-mono text-muted-foreground">{formatPrice(price)}</p>
          <PriceChange value={change} className="text-xs" />
        </div>
      </div>
    </Link>
  );
}
