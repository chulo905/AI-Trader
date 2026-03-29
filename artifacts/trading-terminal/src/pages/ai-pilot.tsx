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
  TrendingUp, TrendingDown, Shield, Zap, Activity, Target, Eye,
  ChevronRight, Clock, BarChart2, XCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ExtendedIndicators } from "@/hooks/use-autopilot";

function GradeBadge({ grade }: { grade?: string }) {
  if (!grade) return null;
  const color =
    grade === "A+" ? "border-bullish/60 text-bullish bg-bullish/10" :
    grade === "A"  ? "border-bullish/40 text-bullish bg-bullish/8" :
    grade === "B"  ? "border-primary/40 text-primary bg-primary/8" :
    grade === "C"  ? "border-yellow-500/40 text-yellow-400 bg-yellow-500/8" :
    grade === "D"  ? "border-orange-500/40 text-orange-400 bg-orange-500/8" :
                    "border-bearish/40 text-bearish bg-bearish/8";
  return (
    <span className={cn("inline-flex items-center border rounded-sm px-2 py-1 text-xs font-bold font-mono tabular-nums uppercase tracking-widest", color)}>
      {grade}
    </span>
  );
}

function RegimePill({ regime, label }: { regime?: string; label?: string }) {
  if (!regime || !label) return null;
  const color =
    regime === "strong-bull" ? "bg-bullish/15 text-bullish border-bullish/30" :
    regime === "bull"        ? "bg-bullish/10 text-bullish/80 border-bullish/20" :
    regime === "bear"        ? "bg-bearish/10 text-bearish/80 border-bearish/20" :
    regime === "strong-bear" ? "bg-bearish/15 text-bearish border-bearish/30" :
                               "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center gap-1 border rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-widest", color)}>
      <BarChart2 className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

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
      <div className="flex items-center justify-between mb-6">
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
                    <span className="font-medium">8-step AI analysis running</span>
                    <span className="text-muted-foreground">— quick scan shown. Full reasoning with grade, bull/bear case & catalysts in ~30s.</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Decision Card */}
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

                  <div className="mb-5 flex items-center gap-2 flex-wrap">
                    <ActionBadge action={decision.action} className="text-sm" />
                    {(decision as any).grade && <GradeBadge grade={(decision as any).grade} />}
                    {(decision as any).regimeLabel && <RegimePill regime={(decision as any).regime} label={(decision as any).regimeLabel} />}
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

              {/* Bull Case / Bear Case */}
              {aiPowered && ((decision as any).bullCase || (decision as any).bearCase) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(decision as any).bullCase && (
                    <Card className="border-bullish/20">
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-3.5 h-3.5 text-bullish" />
                          <span className="text-[10px] font-bold text-bullish/80 uppercase tracking-widest">Bull Case</span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/80">{(decision as any).bullCase}</p>
                      </div>
                    </Card>
                  )}
                  {(decision as any).bearCase && (
                    <Card className="border-bearish/20">
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingDown className="w-3.5 h-3.5 text-bearish" />
                          <span className="text-[10px] font-bold text-bearish/80 uppercase tracking-widest">Bear Case</span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/80">{(decision as any).bearCase}</p>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Invalidation + Catalysts */}
              {aiPowered && ((decision as any).invalidationLevel || ((decision as any).catalysts?.length > 0)) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(decision as any).invalidationLevel && (
                    <Card className="border-warning/20">
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="w-3.5 h-3.5 text-warning" />
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Trade Invalidation</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">Close trade immediately if price breaks:</p>
                        <p className="text-xl font-mono font-bold tabular-nums text-warning">
                          {formatPrice((decision as any).invalidationLevel)}
                        </p>
                        {(decision as any).timeInTrade && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">Hold for: {(decision as any).timeInTrade}</span>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                  {(decision as any).catalysts?.length > 0 && (
                    <Card>
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Catalysts to Watch</span>
                        </div>
                        <ul className="flex flex-col gap-1.5">
                          {(decision as any).catalysts.map((c: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                              <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* What to Expect / Biggest Risk */}
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
                      <div className="flex items-center gap-2">
                        <ActionBadge action={decision.action} className="text-xs" />
                        {(decision as any).grade && <GradeBadge grade={(decision as any).grade} />}
                      </div>
                    </PlanRow>
                    <PlanRow label="Suggested Qty" sub="2% portfolio risk">
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
                      <span className={cn("font-mono font-bold tabular-nums",
                        decision.riskReward >= 2.5 ? "text-bullish" :
                        decision.riskReward >= 1.5 ? "text-foreground" :
                        "text-bearish"
                      )}>{decision.riskReward.toFixed(1)}×</span>
                    </PlanRow>
                  </div>
                  <div className="p-4 border-t border-border bg-muted/40">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Total investment</span>
                      <span className="font-mono tabular-nums">{formatCurrency(decision.suggestedShares * decision.price)}</span>
                    </div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Max loss</span>
                      <span className="font-mono text-bearish tabular-nums">{formatCurrency(decision.suggestedShares * (decision.price - decision.stopLoss))}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Target gain</span>
                      <span className="font-mono text-bullish tabular-nums">{formatCurrency(decision.suggestedShares * (decision.takeProfit - decision.price))}</span>
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
                    <Target className="w-4 h-4" />
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
  const { williamsR, cci, aroon, adx, ichimoku, obvTrend, parabolicSAR } = extended as any;
  const hasData = williamsR != null || cci != null || aroon || adx || ichimoku || obvTrend || parabolicSAR != null;
  if (!hasData) return null;

  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">All Indicators</span>
        </div>
        <div className="flex flex-col gap-2">
          {williamsR != null && (
            <IndicatorRow label="Williams %R" value={`${williamsR}`}
              color={williamsR >= -20 ? "text-bearish" : williamsR <= -80 ? "text-bullish" : "text-foreground"}
              note={williamsR >= -20 ? "Overbought" : williamsR <= -80 ? "Oversold" : "Neutral"} />
          )}
          {cci != null && (
            <IndicatorRow label="CCI (20)" value={`${cci}`}
              color={cci >= 100 ? "text-bearish" : cci <= -100 ? "text-bullish" : "text-foreground"}
              note={cci >= 100 ? "Overbought" : cci <= -100 ? "Oversold" : "Normal"} />
          )}
          {aroon && (
            <IndicatorRow label="Aroon (25)" value={`${aroon.aroonUp}/${aroon.aroonDown}`}
              color={aroon.aroonOscillator > 20 ? "text-bullish" : aroon.aroonOscillator < -20 ? "text-bearish" : "text-foreground"}
              note={aroon.trend.replace(/-/g, " ")} />
          )}
          {adx && (
            <IndicatorRow label="ADX (14)" value={`${adx.adx}`}
              color={adx.adx > 25 ? "text-foreground" : "text-muted-foreground"}
              note={adx.trendStrength} />
          )}
          {ichimoku && (
            <IndicatorRow label="Ichimoku" value={ichimoku.aboveCloud ? "Above Cloud" : "Below Cloud"}
              color={ichimoku.aboveCloud ? "text-bullish" : "text-bearish"}
              note={ichimoku.aboveCloud ? "Bullish" : "Bearish"} />
          )}
          {obvTrend && (
            <IndicatorRow label="OBV Trend" value={obvTrend}
              color={obvTrend === "rising" ? "text-bullish" : obvTrend === "falling" ? "text-bearish" : "text-foreground"}
              note={obvTrend === "rising" ? "Accumulation" : obvTrend === "falling" ? "Distribution" : "Neutral"} />
          )}
          {parabolicSAR != null && (
            <IndicatorRow label="Parabolic SAR" value={formatPrice(parabolicSAR)}
              color="text-foreground"
              note="" />
          )}
        </div>
      </div>
    </Card>
  );
}

function IndicatorRow({ label, value, color, note }: { label: string; value: string; color: string; note: string }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-bold", color)}>
        {value}{note ? ` · ${note}` : ""}
      </span>
    </div>
  );
}

function AIPilotSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-2 flex flex-col gap-4">
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-80" />
        <Skeleton className="h-12" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
