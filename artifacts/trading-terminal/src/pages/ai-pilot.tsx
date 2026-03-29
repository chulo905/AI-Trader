import React from "react";
import { useLocation } from "wouter";
import { useAppState } from "@/hooks/use-app-state";
import { useAiPilotExecution } from "@/hooks/use-ai-pilot-execution";
import { useGetPositions, useCloseTrade } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card, CardHeader, CardTitle, CardContent, Btn,
  ActionBadge, ConfidenceRing, PriceChange, PageTransition, Skeleton, ErrorPanel
} from "@/components/terminal-ui";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { formatCurrency, formatPrice, resolvePositions } from "@/lib/utils";
import {
  Sparkles, RefreshCw, CheckCircle2, AlertTriangle, Lightbulb,
  TrendingUp, Shield, Zap, Activity
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ExtendedIndicators } from "@/hooks/use-autopilot";

export default function AIPilotPage() {
  const { selectedSymbol, setSelectedSymbol } = useAppState();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const {
    decision,
    isLoading,
    error,
    isFetching,
    refetch,
    aiPowered,
    phase,
    result,
    execute,
  } = useAiPilotExecution(selectedSymbol);

  const { data: positionsData } = useGetPositions({ query: { staleTime: 10000 } });
  const positions = resolvePositions(positionsData);
  const closeMutation = useCloseTrade({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio/positions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      }
    }
  });

  const symbolPositions = positions.filter((p) => p.symbol === selectedSymbol && p.side === "long");
  const isBuy  = decision?.action?.toUpperCase().includes("BUY");
  const isSell = decision?.action?.toUpperCase().includes("SELL");

  return (
    <PageTransition>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5" />
          <h1 className="text-lg font-bold tracking-tight">AI Pilot</h1>
          <span className="text-[10px] font-bold border border-border px-2 py-0.5 rounded-sm text-muted-foreground uppercase tracking-widest">BETA</span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
          {isFetching ? "Analyzing…" : "Refresh"}
        </button>
      </div>

      {error ? <ErrorPanel error={error} /> : isLoading ? <AIPilotSkeleton /> : !decision ? null : (
        <ErrorBoundary label="AI Analysis">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

            {/* LEFT: Decision Panel */}
            <div className="xl:col-span-2 flex flex-col gap-4">

              <AnimatePresence>
                {!aiPowered && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-3 px-4 py-3 border border-border bg-muted text-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-muted-foreground" />
                    <span className="font-medium">Deep AI analysis running in background</span>
                    <span className="text-muted-foreground">— showing quick scan now. Full GPT decision ready in ~30s.</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <Card className={cn(
                "border",
                isBuy  ? "border-bullish/30" :
                isSell ? "border-bearish/30" :
                "border-border"
              )}>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Analyzing</p>
                      <h2 className="text-4xl font-bold font-mono tracking-tight">{selectedSymbol}</h2>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xl font-mono font-semibold tabular-nums">{formatPrice(decision.price)}</span>
                        <PriceChange value={decision.change} showIcon />
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <ConfidenceRing value={decision.confidence} size={84} />
                      <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Confidence</span>
                    </div>
                  </div>

                  <div className="mb-5 flex items-center gap-3">
                    <ActionBadge action={decision.action} className="text-sm" />
                    {aiPowered && (
                      <span className="text-[10px] font-bold border border-border px-2 py-1 rounded-sm text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> GPT-Powered
                      </span>
                    )}
                  </div>

                  <p className={cn("text-base font-semibold leading-snug mb-4",
                    isBuy ? "text-bullish" : isSell ? "text-bearish" : "text-foreground"
                  )}>
                    {decision.headline}
                  </p>

                  <div className="bg-muted border border-border p-4 rounded-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">What the AI sees</span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/85">{decision.reasoning}</p>
                  </div>
                </div>
              </Card>

              {(decision.whatHappensNext || decision.riskNote) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {decision.whatHappensNext && (
                    <Card>
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">What to Expect</span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/80">{decision.whatHappensNext}</p>
                      </div>
                    </Card>
                  )}
                  {decision.riskNote && (
                    <Card>
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="w-3.5 h-3.5 text-warning" />
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Biggest Risk</span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/80">{decision.riskNote}</p>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className={cn(
                      "flex items-center gap-3 p-4 border text-sm font-medium rounded-sm",
                      result.success ? "border-bullish/30 bg-bullish/8 text-bullish" : "border-bearish/30 bg-bearish/8 text-bearish"
                    )}
                  >
                    {result.success
                      ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                      : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    {result.message}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* RIGHT: Action Panel */}
            <div className="flex flex-col gap-4">

              <Card>
                <CardHeader>
                  <CardTitle>AI Trade Plan</CardTitle>
                  <span className="text-[9px] font-bold border border-border px-1.5 py-0.5 rounded-sm text-muted-foreground uppercase tracking-wider">Paper</span>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    <PlanRow label="Action">
                      <ActionBadge action={decision.action} className="text-xs" />
                    </PlanRow>
                    <PlanRow label="Suggested Qty" sub="~$1,000 budget">
                      <span className="font-mono font-bold text-lg tabular-nums">{decision.suggestedShares} shares</span>
                    </PlanRow>
                    <PlanRow label="Entry Price">
                      <span className="font-mono font-semibold tabular-nums">{formatPrice(decision.price)}</span>
                    </PlanRow>
                    <PlanRow label="Stop Loss" sub="Max loss cutoff">
                      <span className="font-mono font-semibold text-bearish tabular-nums">{formatPrice(decision.stopLoss)}</span>
                    </PlanRow>
                    <PlanRow label="Take Profit" sub="Target exit">
                      <span className="font-mono font-semibold text-bullish tabular-nums">{formatPrice(decision.takeProfit)}</span>
                    </PlanRow>
                    <PlanRow label="Risk/Reward">
                      <span className="font-mono font-bold tabular-nums">{decision.riskReward.toFixed(1)}×</span>
                    </PlanRow>
                  </div>
                  <div className="p-4 border-t border-border bg-muted/40">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Total investment</span>
                      <span className="font-mono tabular-nums">{formatCurrency(decision.suggestedShares * decision.price)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Max loss</span>
                      <span className="font-mono text-bearish tabular-nums">{formatCurrency(decision.suggestedShares * (decision.price - decision.stopLoss))}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {decision.action === "HOLD" ? (
                <div className="p-4 border border-border bg-muted rounded-sm text-center">
                  <p className="text-sm font-semibold text-muted-foreground">Hold — Wait for a better entry.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">No trade recommended right now.</p>
                </div>
              ) : (
                <>
                  <Btn
                    variant={isBuy ? "success" : "danger"}
                    size="xl"
                    className="w-full"
                    onClick={execute}
                    disabled={phase === "executing" || phase === "done"}
                  >
                    {phase === "executing" ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Executing…</>
                    ) : phase === "done" ? (
                      <><CheckCircle2 className="w-4 h-4" /> Trade Executed</>
                    ) : (
                      <><Zap className="w-4 h-4" /> Let AI {isBuy ? "Buy" : "Sell"} {selectedSymbol}</>
                    )}
                  </Btn>
                  <Btn
                    variant="outline"
                    size="lg"
                    className="w-full"
                    onClick={() => {
                      setSelectedSymbol(selectedSymbol);
                      const params = new URLSearchParams({
                        symbol: selectedSymbol,
                        side: isBuy ? "long" : "short",
                        entry: String(decision.price),
                        stop: String(decision.stopLoss),
                        target: String(decision.takeProfit),
                        shares: String(decision.suggestedShares),
                      });
                      setLocation(`/trade?${params.toString()}`);
                    }}
                  >
                    <Zap className="w-4 h-4" />
                    Pre-fill Order Ticket
                  </Btn>
                </>
              )}

              <p className="text-[10px] text-center text-muted-foreground/50 leading-relaxed px-2">
                Paper trade only. No real money involved. Not financial advice.
              </p>

              <ExtendedIndicatorsPanel extended={decision?.extended} />

              {symbolPositions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedSymbol} Positions</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {symbolPositions.map((pos: any) => (
                        <div key={pos.id} className="p-4 flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-mono font-semibold">{pos.shares} sh @ {formatPrice(pos.entryPrice)}</span>
                            <span className={cn("text-sm font-bold font-mono tabular-nums", pos.unrealizedPnl >= 0 ? "text-bullish" : "text-bearish")}>
                              {pos.unrealizedPnl >= 0 ? "+" : ""}{formatCurrency(pos.unrealizedPnl)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground font-mono">Now: {formatPrice(pos.currentPrice)}</span>
                            <Btn
                              variant="outline"
                              size="sm"
                              onClick={() => closeMutation.mutate({ id: pos.id, data: { exitPrice: pos.currentPrice } })}
                              disabled={closeMutation.isPending}
                            >
                              Close
                            </Btn>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </ErrorBoundary>
      )}
    </PageTransition>
  );
}

function PlanRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{sub}</p>}
      </div>
      <div className="text-right shrink-0">{children}</div>
    </div>
  );
}

function ExtendedIndicatorsPanel({ extended }: { extended?: ExtendedIndicators }) {
  if (!extended) return null;
  const { williamsR, cci, aroon } = extended;
  if (williamsR == null && cci == null && !aroon) return null;

  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Extended Indicators</span>
        </div>
        <div className="flex flex-col gap-2">
          {williamsR != null && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Williams %R</span>
              <span className={cn("font-mono font-bold", williamsR >= -20 ? "text-bearish" : williamsR <= -80 ? "text-bullish" : "text-foreground")}>
                {williamsR} {williamsR >= -20 ? "· Overbought" : williamsR <= -80 ? "· Oversold" : "· Neutral"}
              </span>
            </div>
          )}
          {cci != null && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">CCI (20)</span>
              <span className={cn("font-mono font-bold", cci >= 100 ? "text-bearish" : cci <= -100 ? "text-bullish" : "text-foreground")}>
                {cci} {cci >= 100 ? "· Overbought" : cci <= -100 ? "· Oversold" : "· Normal"}
              </span>
            </div>
          )}
          {aroon && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Aroon (25)</span>
              <span className={cn("font-mono font-bold", aroon.aroonOscillator > 20 ? "text-bullish" : aroon.aroonOscillator < -20 ? "text-bearish" : "text-foreground")}>
                {aroon.aroonUp}/{aroon.aroonDown} · {aroon.trend.replace(/-/g, " ")}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function AIPilotSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-2 flex flex-col gap-4">
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-80" />
        <Skeleton className="h-12" />
      </div>
    </div>
  );
}
