import { useGetPortfolio, useGetTradeStats, useGetTrades, useGetPositions, useCloseTrade } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent, StatCard, PageTransition, Skeleton, ErrorPanel, Btn, PriceChange, Table } from "@/components/terminal-ui";
import { formatCurrency, formatPrice, formatPercent } from "@/lib/utils";
import { useAppState } from "@/hooks/use-app-state";
import { useQueryClient } from "@tanstack/react-query";
import { Briefcase, TrendingUp, Trophy, Target, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PortfolioPage() {
  const { setSelectedSymbol } = useAppState();
  const queryClient = useQueryClient();
  const { data: portfolio, isLoading: loadPort, error: errPort } = useGetPortfolio();
  const { data: stats, isLoading: loadStats } = useGetTradeStats();
  const { data: positionsData, isLoading: loadPos } = useGetPositions();
  const positions = Array.isArray((positionsData as any)?.positions) ? (positionsData as any).positions : Array.isArray(positionsData) ? positionsData : [];
  const { data: trades, isLoading: loadTrades } = useGetTrades({ limit: 30 });

  const closeMutation = useCloseTrade({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio/positions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      }
    }
  });

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-2">
        <Briefcase className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">Portfolio</h1>
      </div>

      {/* Summary Stats */}
      {errPort ? <ErrorPanel error={errPort} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Value"
            value={formatCurrency(portfolio?.equity ?? 0)}
            sub={`Cash: ${formatCurrency(portfolio?.cash ?? 0)}`}
          />
          <StatCard
            label="Today's P&L"
            value={`${(portfolio?.todayPnl ?? 0) >= 0 ? "+" : ""}${formatCurrency(portfolio?.todayPnl ?? 0)}`}
            valueClass={(portfolio?.todayPnl ?? 0) >= 0 ? "text-bullish" : "text-bearish"}
          />
          <StatCard
            label="All-Time Profit"
            value={`${(portfolio?.totalPnl ?? 0) >= 0 ? "+" : ""}${formatCurrency(portfolio?.totalPnl ?? 0)}`}
            valueClass={(portfolio?.totalPnl ?? 0) >= 0 ? "text-bullish" : "text-bearish"}
          />
          <StatCard
            label="Open Positions"
            value={portfolio?.openPositions ?? 0}
            sub="Active trades"
            valueClass="text-primary"
          />
        </div>
      )}

      {/* Performance Stats */}
      {!loadStats && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <PerformanceStat icon={<Trophy className="w-4 h-4 text-warning" />} label="Win Rate" value={`${stats.winRate}%`} sub={`${stats.winCount}W / ${stats.lossCount}L`} />
          <PerformanceStat icon={<TrendingUp className="w-4 h-4 text-bullish" />} label="Profit Factor" value={stats.profitFactor.toFixed(2)} sub="Higher is better" />
          <PerformanceStat icon={<Target className="w-4 h-4 text-primary" />} label="Avg Gain" value={formatCurrency(stats.avgGain)} valueClass="text-bullish" />
          <PerformanceStat icon={<X className="w-4 h-4 text-bearish" />} label="Avg Loss" value={formatCurrency(stats.avgLoss)} valueClass="text-bearish" />
        </div>
      )}

      {/* Open Positions */}
      <Card>
        <CardHeader>
          <CardTitle>Open Positions</CardTitle>
        </CardHeader>
        <CardContent>
          {loadPos ? <Skeleton className="h-40" /> : !positions?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No open positions. Use AI Pilot to start trading.</p>
          ) : (
            <Table headers={["Stock", "Shares", "You Paid", "Now Worth", "Profit/Loss", ""]}>
              {positions.map(pos => (
                <tr key={pos.id} className="hover:bg-muted/20 cursor-pointer group" onClick={() => setSelectedSymbol(pos.symbol)}>
                  <td className="px-4 py-3.5 first:pl-5">
                    <p className="font-bold font-mono">{pos.symbol}</p>
                    <span className={cn("text-xs font-medium", pos.side === "long" ? "text-bullish" : "text-bearish")}>{pos.side === "long" ? "Bought" : "Shorted"}</span>
                  </td>
                  <td className="px-4 py-3.5 font-mono">{pos.shares}</td>
                  <td className="px-4 py-3.5 font-mono">{formatPrice(pos.entryPrice)}</td>
                  <td className="px-4 py-3.5 font-mono">{formatPrice(pos.currentPrice)}</td>
                  <td className="px-4 py-3.5">
                    <p className={cn("font-mono font-bold", pos.unrealizedPnl >= 0 ? "text-bullish" : "text-bearish")}>
                      {pos.unrealizedPnl >= 0 ? "+" : ""}{formatCurrency(pos.unrealizedPnl)}
                    </p>
                    <PriceChange value={pos.unrealizedPnlPercent} className="text-xs" />
                  </td>
                  <td className="px-4 py-3.5 last:pr-5 text-right">
                    <Btn
                      variant="outline" size="sm"
                      onClick={e => { e.stopPropagation(); closeMutation.mutate({ id: pos.id, data: { exitPrice: pos.currentPrice } }); }}
                      disabled={closeMutation.isPending}
                    >
                      Sell / Close
                    </Btn>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Trade History */}
      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
        </CardHeader>
        <CardContent>
          {loadTrades ? <Skeleton className="h-48" /> : (
            <Table headers={["Date", "Stock", "Action", "Shares", "Bought At", "Sold At", "Profit/Loss"]}>
              {trades?.filter(t => t.status === "closed").map(t => (
                <tr key={t.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 first:pl-5 text-xs text-muted-foreground font-mono">{new Date(t.closedAt!).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-bold font-mono">{t.symbol}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-semibold", t.side === "long" ? "text-bullish" : "text-bearish")}>
                      {t.side === "long" ? "Bought" : "Sold Short"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">{t.shares}</td>
                  <td className="px-4 py-3 font-mono text-sm">{formatPrice(t.entryPrice)}</td>
                  <td className="px-4 py-3 font-mono text-sm">{formatPrice(t.exitPrice)}</td>
                  <td className="px-4 py-3 last:pr-5 text-right">
                    <span className={cn("font-mono font-bold", (t.realizedPnl ?? 0) >= 0 ? "text-bullish" : "text-bearish")}>
                      {(t.realizedPnl ?? 0) >= 0 ? "+" : ""}{formatCurrency(t.realizedPnl)}
                    </span>
                  </td>
                </tr>
              ))}
              {!trades?.filter(t => t.status === "closed").length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No completed trades yet.</td>
                </tr>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </PageTransition>
  );
}

function PerformanceStat({ icon, label, value, sub, valueClass }: { icon: React.ReactNode; label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="p-4 rounded-sm border border-border bg-card flex items-start gap-3">
      <div className="w-9 h-9 rounded-sm bg-muted flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-xl font-bold font-mono", valueClass)}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
