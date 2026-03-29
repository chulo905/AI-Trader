import { useGetPortfolio, useGetTradeStats, useGetTrades } from "@workspace/api-client-react";
import { TerminalCard, PageTransition, TerminalSkeleton, ErrorPanel, TerminalTable, DataPoint, PriceChange } from "@/components/terminal-ui";
import { formatCurrency, formatPercent, formatPrice } from "@/lib/utils";
import { PieChart, Briefcase, Activity } from "lucide-react";

export default function PortfolioPage() {
  const { data: portfolio, isLoading: loadingPort, error: errorPort } = useGetPortfolio();
  const { data: stats, isLoading: loadingStats } = useGetTradeStats();
  const { data: trades, isLoading: loadingTrades } = useGetTrades({ limit: 20 });

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-6">
        <PieChart className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Portfolio & Performance</h1>
      </div>

      {errorPort ? <ErrorPanel error={errorPort} /> : loadingPort ? <TerminalSkeleton className="h-[200px] mb-6" /> : portfolio && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <TerminalCard>
            <div className="flex flex-col justify-center h-full">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2">Net Liquidity</span>
              <span className="text-2xl font-mono font-bold text-foreground">{formatCurrency(portfolio.equity)}</span>
              <div className="mt-2 text-xs font-mono text-muted-foreground">Cash: {formatCurrency(portfolio.cash)}</div>
            </div>
          </TerminalCard>
          <TerminalCard>
            <div className="flex flex-col justify-center h-full">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2">Day P&L</span>
              <span className={`text-2xl font-mono font-bold ${portfolio.todayPnl >= 0 ? 'text-bullish drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'text-bearish'}`}>
                {portfolio.todayPnl >= 0 ? '+' : ''}{formatCurrency(portfolio.todayPnl)}
              </span>
            </div>
          </TerminalCard>
          <TerminalCard>
            <div className="flex flex-col justify-center h-full">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2">Total P&L</span>
              <span className={`text-2xl font-mono font-bold ${portfolio.totalPnl >= 0 ? 'text-bullish drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'text-bearish'}`}>
                {portfolio.totalPnl >= 0 ? '+' : ''}{formatCurrency(portfolio.totalPnl)}
              </span>
            </div>
          </TerminalCard>
          <TerminalCard>
            <div className="flex flex-col justify-center h-full">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2">Open Positions</span>
              <span className="text-2xl font-mono font-bold text-primary">{portfolio.openPositions}</span>
            </div>
          </TerminalCard>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Stats */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <TerminalCard title="Performance Stats">
            {loadingStats ? <TerminalSkeleton className="h-[300px]" /> : stats && (
              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <DataPoint label="Win Rate" value={`${stats.winRate}%`} valueClass="text-xl" />
                <DataPoint label="Profit Factor" value={stats.profitFactor.toFixed(2)} valueClass="text-xl text-primary" />
                <DataPoint label="Avg Gain" value={formatCurrency(stats.avgGain)} valueClass="text-bullish text-lg" />
                <DataPoint label="Avg Loss" value={formatCurrency(stats.avgLoss)} valueClass="text-bearish text-lg" />
                <DataPoint label="Best Trade" value={formatCurrency(stats.bestTrade)} valueClass="text-bullish text-lg" />
                <DataPoint label="Worst Trade" value={formatCurrency(stats.worstTrade)} valueClass="text-bearish text-lg" />
                <DataPoint label="Total Trades" value={stats.totalTrades} valueClass="text-lg" />
                <DataPoint label="W / L" value={`${stats.winCount} / ${stats.lossCount}`} valueClass="text-lg" />
              </div>
            )}
          </TerminalCard>
        </div>

        {/* Right Col: Trade History */}
        <div className="lg:col-span-2">
          <TerminalCard title="Recent Closed Trades" action={<Activity className="w-4 h-4 text-muted-foreground" />}>
            {loadingTrades ? <TerminalSkeleton className="h-[400px]" /> : (
              <TerminalTable headers={["Date", "Symbol", "Side", "Qty", "Entry", "Exit", "P&L"]}>
                {trades?.filter(t => t.status === 'closed').map(trade => (
                  <tr key={trade.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{new Date(trade.closedAt!).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-bold font-mono text-sm">{trade.symbol}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold uppercase ${trade.side === 'long' ? 'text-bullish' : 'text-bearish'}`}>{trade.side}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{trade.shares}</td>
                    <td className="px-4 py-3 font-mono text-sm">{formatPrice(trade.entryPrice)}</td>
                    <td className="px-4 py-3 font-mono text-sm">{formatPrice(trade.exitPrice)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono font-bold text-sm ${trade.realizedPnl! >= 0 ? "text-bullish" : "text-bearish"}`}>
                        {formatCurrency(trade.realizedPnl)}
                      </span>
                    </td>
                  </tr>
                ))}
                {!trades?.filter(t => t.status === 'closed').length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No closed trades yet.</td>
                  </tr>
                )}
              </TerminalTable>
            )}
          </TerminalCard>
        </div>
      </div>
    </PageTransition>
  );
}
