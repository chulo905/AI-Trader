import React from "react";
import { useAppState } from "@/hooks/use-app-state";
import { usePaperTradeForm } from "@/hooks/use-paper-trade-form";
import { TerminalCard, PageTransition, TerminalSkeleton, ErrorPanel, TerminalTable, TerminalButton, TerminalInput, TerminalLabel, PriceChange } from "@/components/terminal-ui";
import { formatCurrency, formatPrice } from "@/lib/utils";
import { ArrowRightLeft } from "lucide-react";

export default function PaperTradingPage() {
  const { selectedSymbol, setSelectedSymbol } = useAppState();

  const {
    positions,
    isLoading,
    error,
    quote,
    side,
    setSide,
    shares,
    setShares,
    entryPrice,
    setEntryPrice,
    stopLoss,
    setStopLoss,
    takeProfit,
    setTakeProfit,
    submitTrade,
    closePosition,
    isSubmitting,
    isClosing,
  } = usePaperTradeForm(selectedSymbol);

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-6">
        <ArrowRightLeft className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Paper Trading</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <TerminalCard title="Order Ticket">
            <form onSubmit={submitTrade} className="flex flex-col gap-5">
              
              <div className="flex gap-2 p-1 bg-muted rounded-sm border border-border/50">
                <button type="button" onClick={() => setSide("long")} className={`flex-1 py-2 text-sm font-bold uppercase rounded-sm transition-all ${side === "long" ? "bg-bullish text-white shadow-none" : "text-muted-foreground hover:text-foreground"}`}>
                  Buy / Long
                </button>
                <button type="button" onClick={() => setSide("short")} className={`flex-1 py-2 text-sm font-bold uppercase rounded-sm transition-all ${side === "short" ? "bg-bearish text-white shadow-none" : "text-muted-foreground hover:text-foreground"}`}>
                  Sell / Short
                </button>
              </div>

              <div>
                <TerminalLabel>Symbol</TerminalLabel>
                <div className="relative">
                  <TerminalInput
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                    placeholder="AAPL"
                    className="font-bold text-lg uppercase"
                    required
                  />
                  {quote && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                      Current: {formatPrice(quote.price)}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <TerminalLabel>Quantity</TerminalLabel>
                  <TerminalInput type="number" value={shares} onChange={e => setShares(e.target.value)} min="1" required />
                </div>
                <div>
                  <TerminalLabel>Price (Limit)</TerminalLabel>
                  <TerminalInput type="number" step="0.01" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <TerminalLabel>Stop Loss (Opt)</TerminalLabel>
                  <TerminalInput type="number" step="0.01" value={stopLoss} onChange={e => setStopLoss(e.target.value)} />
                </div>
                <div>
                  <TerminalLabel>Take Profit (Opt)</TerminalLabel>
                  <TerminalInput type="number" step="0.01" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} />
                </div>
              </div>

              <div className="bg-background border border-border/50 rounded-sm p-3 text-sm font-mono mt-2">
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Est. Value</span>
                  <span>{formatCurrency(Number(shares) * Number(entryPrice || 0))}</span>
                </div>
              </div>

              <TerminalButton
                type="submit"
                variant={side === "long" ? "bullish" : "bearish"}
                size="lg"
                className="w-full mt-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : `Submit ${side.toUpperCase()} Order`}
              </TerminalButton>

            </form>
          </TerminalCard>
        </div>

        <div className="xl:col-span-2">
          <TerminalCard title="Open Positions">
            {error ? <ErrorPanel error={error} /> : isLoading ? <TerminalSkeleton className="h-[400px]" /> : (
              <TerminalTable headers={["Symbol", "Side", "Shares", "Avg Cost", "Current", "P&L", "Action"]}>
                {positions?.map(pos => (
                  <tr key={pos.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-bold font-mono text-base">{pos.symbol}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold uppercase ${pos.side === "long" ? "text-bullish bg-bullish/10 px-2 py-1 rounded" : "text-bearish bg-bearish/10 px-2 py-1 rounded"}`}>{pos.side}</span>
                    </td>
                    <td className="px-4 py-3 font-mono">{pos.shares}</td>
                    <td className="px-4 py-3 font-mono">{formatPrice(pos.entryPrice)}</td>
                    <td className="px-4 py-3 font-mono">{formatPrice(pos.currentPrice)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`font-mono font-bold ${pos.unrealizedPnl >= 0 ? "text-bullish" : "text-bearish"}`}>
                          {formatCurrency(pos.unrealizedPnl)}
                        </span>
                        <PriceChange value={pos.unrealizedPnlPercent} className="text-xs" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <TerminalButton
                        size="sm"
                        variant="outline"
                        onClick={() => closePosition(pos.id, pos.currentPrice)}
                        disabled={isClosing}
                      >
                        Close
                      </TerminalButton>
                    </td>
                  </tr>
                ))}
                {!positions?.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground border border-dashed border-border/50 rounded-sm">
                      No open positions. Execute a trade to see it here.
                    </td>
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
