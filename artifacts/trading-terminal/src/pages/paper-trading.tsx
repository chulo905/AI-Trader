import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAppState } from "@/hooks/use-app-state";
import { usePaperTradeForm } from "@/hooks/use-paper-trade-form";
import { TerminalCard, PageTransition, TerminalSkeleton, ErrorPanel, TerminalTable, TerminalButton, TerminalInput, TerminalLabel, PriceChange } from "@/components/terminal-ui";
import { formatCurrency, formatPrice } from "@/lib/utils";
import { ArrowRightLeft, AlertTriangle, ChevronDown } from "lucide-react";
import { useTickerPrice } from "@/hooks/use-ticker-price";
import { cn } from "@/lib/utils";

export default function PaperTradingPage() {
  const { selectedSymbol, setSelectedSymbol } = useAppState();
  const [, setLocation] = useLocation();

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
    requestClosePosition,
    confirmClosePosition,
    cancelClose,
    closePartialPosition,
    confirmClose,
    isSubmitting,
    isClosing,
    isPartialClosing,
    atr,
    isLoadingAtr,
    suggestStop,
    riskRewardMetrics,
    settings,
  } = usePaperTradeForm(selectedSymbol);

  const { price: liveSelectedPrice, flashDirection: selectedFlash } = useTickerPrice(selectedSymbol);
  const [openPartialMenu, setOpenPartialMenu] = useState<number | null>(null);
  const [customPct, setCustomPct] = useState<string>("");

  const { dollarRisk, riskRewardRatio, expectedGain, suggestedShares } = riskRewardMetrics;

  const handlePartialClose = async (posId: number, percent: number, currentPrice: number) => {
    setOpenPartialMenu(null);
    await closePartialPosition(posId, percent, currentPrice);
  };

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-6">
        <ArrowRightLeft className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Paper Trading</h1>
      </div>

      {/* Close Confirmation Dialog */}
      {confirmClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-background border border-border rounded-sm p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <h2 className="font-bold text-base">Confirm Close</h2>
            </div>
            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Symbol</span>
                <span className="font-mono font-bold">{confirmClose.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shares</span>
                <span className="font-mono">{confirmClose.shares}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exit Price</span>
                <span className="font-mono">{formatPrice(confirmClose.price)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 mt-2">
                <span className="text-muted-foreground font-semibold">Expected P&L</span>
                <span className={`font-mono font-bold ${confirmClose.pnl >= 0 ? "text-bullish" : "text-bearish"}`}>
                  {confirmClose.pnl >= 0 ? "+" : ""}{formatCurrency(confirmClose.pnl)}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <TerminalButton variant="outline" className="flex-1" onClick={cancelClose}>
                Cancel
              </TerminalButton>
              <TerminalButton
                variant={confirmClose.pnl >= 0 ? "bullish" : "bearish"}
                className="flex-1"
                onClick={confirmClosePosition}
                disabled={isClosing}
              >
                {isClosing ? "Closing…" : "Confirm Close"}
              </TerminalButton>
            </div>
          </div>
        </div>
      )}

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
                  {(liveSelectedPrice !== null || quote) && (
                    <div className={cn(
                      "absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono transition-colors duration-300",
                      selectedFlash === "up" && "text-bullish",
                      selectedFlash === "down" && "text-bearish",
                      !selectedFlash && "text-muted-foreground"
                    )}>
                      {formatPrice(liveSelectedPrice ?? quote?.price ?? 0)}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <TerminalLabel>Quantity</TerminalLabel>
                  <TerminalInput type="number" value={shares} onChange={e => setShares(e.target.value)} min="1" required />
                  {suggestedShares !== null && (
                    <button
                      type="button"
                      className="mt-1 text-xs text-primary hover:underline"
                      onClick={() => setShares(suggestedShares.toString())}
                    >
                      Suggested: {suggestedShares} shares ({settings?.maxRiskPerTrade ?? 2}% risk)
                    </button>
                  )}
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
                  {atr !== null && (
                    <button
                      type="button"
                      className="mt-1 text-xs text-primary hover:underline"
                      onClick={suggestStop}
                      disabled={isLoadingAtr}
                    >
                      {isLoadingAtr ? "Loading ATR…" : `Suggest Stop (ATR ${formatPrice(atr)})`}
                    </button>
                  )}
                </div>
                <div>
                  <TerminalLabel>Take Profit (Opt)</TerminalLabel>
                  <TerminalInput type="number" step="0.01" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} />
                </div>
              </div>

              <div className="bg-background border border-border/50 rounded-sm p-3 text-sm font-mono mt-2 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Value</span>
                  <span>{formatCurrency(Number(shares) * Number(entryPrice || 0))}</span>
                </div>
                {dollarRisk !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dollar Risk</span>
                    <span className="text-bearish">{formatCurrency(dollarRisk)}</span>
                  </div>
                )}
                {riskRewardRatio !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">R:R Ratio</span>
                    <span className={riskRewardRatio >= 2 ? "text-bullish" : riskRewardRatio >= 1 ? "text-foreground" : "text-bearish"}>
                      {riskRewardRatio.toFixed(2)}×
                    </span>
                  </div>
                )}
                {expectedGain !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expected Gain</span>
                    <span className="text-bullish">{formatCurrency(expectedGain)}</span>
                  </div>
                )}
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
              <div className="overflow-x-auto">
                <TerminalTable headers={["Symbol", "Side", "Shares", "Avg Cost", "Current", "P&L", "Action"]}>
                  {positions?.map((pos: any) => (
                    <LivePositionRow
                      key={pos.id}
                      pos={pos}
                      onClose={() => requestClosePosition(pos.id, pos.currentPrice, pos.shares, pos.symbol, pos.entryPrice, pos.side)}
                      onPartialClose={(pct) => handlePartialClose(pos.id, pct, pos.currentPrice)}
                      isClosing={isClosing}
                      isPartialClosing={isPartialClosing}
                      openPartialMenu={openPartialMenu}
                      setOpenPartialMenu={setOpenPartialMenu}
                      customPct={customPct}
                      setCustomPct={setCustomPct}
                    />
                  ))}
                  {!positions?.length && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground border border-dashed border-border/50 rounded-sm">
                        No open positions. Execute a trade to see it here.
                      </td>
                    </tr>
                  )}
                </TerminalTable>
              </div>
            )}
          </TerminalCard>
        </div>
      </div>
    </PageTransition>
  );
}

interface PositionData {
  id: number;
  symbol: string;
  side: string;
  shares: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

function LivePositionRow({
  pos,
  onClose,
  onPartialClose,
  isClosing,
  isPartialClosing,
  openPartialMenu,
  setOpenPartialMenu,
  customPct,
  setCustomPct,
}: {
  pos: PositionData;
  onClose: () => void;
  onPartialClose: (pct: number) => void;
  isClosing: boolean;
  isPartialClosing: boolean;
  openPartialMenu: number | null;
  setOpenPartialMenu: (id: number | null) => void;
  customPct: string;
  setCustomPct: (v: string) => void;
}) {
  const { price: livePrice, flashDirection } = useTickerPrice(pos.symbol);
  const displayPrice = livePrice ?? pos.currentPrice;

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3 font-bold font-mono text-base">{pos.symbol}</td>
      <td className="px-4 py-3">
        <span className={`text-xs font-bold uppercase ${pos.side === "long" ? "text-bullish bg-bullish/10 px-2 py-1 rounded" : "text-bearish bg-bearish/10 px-2 py-1 rounded"}`}>{pos.side}</span>
      </td>
      <td className="px-4 py-3 font-mono">{pos.shares}</td>
      <td className="px-4 py-3 font-mono">{formatPrice(pos.entryPrice)}</td>
      <td className={cn(
        "px-4 py-3 font-mono tabular-nums transition-colors duration-300",
        flashDirection === "up" && "text-bullish",
        flashDirection === "down" && "text-bearish"
      )}>
        {formatPrice(displayPrice)}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end">
          <span className={`font-mono font-bold ${pos.unrealizedPnl >= 0 ? "text-bullish" : "text-bearish"}`}>
            {formatCurrency(pos.unrealizedPnl)}
          </span>
          <PriceChange value={pos.unrealizedPnlPercent} className="text-xs" />
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="relative inline-flex gap-1">
          <TerminalButton
            size="sm"
            variant="outline"
            onClick={onClose}
            disabled={isClosing || isPartialClosing}
          >
            Close
          </TerminalButton>
          <TerminalButton
            size="sm"
            variant="outline"
            className="px-1.5"
            onClick={() => setOpenPartialMenu(openPartialMenu === pos.id ? null : pos.id)}
            disabled={isClosing || isPartialClosing}
          >
            <ChevronDown className="w-3 h-3" />
          </TerminalButton>
          {openPartialMenu === pos.id && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-border rounded-sm shadow-xl min-w-[140px]">
              {[25, 50, 75].map(pct => (
                <button
                  key={pct}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors font-mono"
                  onClick={() => onPartialClose(pct)}
                >
                  Close {pct}%
                </button>
              ))}
              <div className="border-t border-border px-3 py-2 flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="99"
                  placeholder="Custom %"
                  value={customPct}
                  onChange={e => setCustomPct(e.target.value)}
                  className="w-full text-xs bg-muted border border-border rounded px-2 py-1 font-mono"
                />
                <button
                  className="text-xs text-primary font-bold px-1 hover:underline"
                  onClick={() => {
                    const pct = Number(customPct);
                    if (pct > 0 && pct <= 100) onPartialClose(pct);
                  }}
                >
                  Go
                </button>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
