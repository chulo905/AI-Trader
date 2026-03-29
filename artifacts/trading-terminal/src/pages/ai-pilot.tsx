import React, { useState, useEffect, useRef } from "react";
import { useAppState } from "@/hooks/use-app-state";
import { useAutopilotDecision, useExecuteAutopilotTrade } from "@/hooks/use-autopilot";
import { useGetPositions, useCloseTrade } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card, CardHeader, CardTitle, CardContent, Btn,
  ActionBadge, ConfidenceRing, PriceChange, PageTransition, Skeleton, ErrorPanel, Table
} from "@/components/terminal-ui";
import { formatCurrency, formatPrice, formatPercent } from "@/lib/utils";
import {
  Sparkles, RefreshCw, CheckCircle2, AlertTriangle, Lightbulb,
  TrendingUp, Target, Shield, Zap, Clock, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Phase = "idle" | "executing" | "done" | "error";

export default function AIPilotPage() {
  const { selectedSymbol, setSelectedSymbol } = useAppState();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<{ message: string; success: boolean } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    data: decision,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useAutopilotDecision(selectedSymbol, { staleTime: 3 * 60 * 1000 });

  const { data: positions } = useGetPositions({ query: { staleTime: 10000 } });
  const executeMutation = useExecuteAutopilotTrade();
  const closeMutation = useCloseTrade({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio/positions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      }
    }
  });

  const aiPowered = decision?.aiPowered === true;

  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (decision && !aiPowered) {
      pollingRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/autopilot/${selectedSymbol}`] });
      }, 12_000);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [decision, aiPowered, selectedSymbol, queryClient]);

  useEffect(() => {
    setPhase("idle");
    setResult(null);
  }, [selectedSymbol]);

  const handleExecute = async () => {
    if (!decision) return;
    setPhase("executing");
    setResult(null);
    try {
      const res = await executeMutation.mutateAsync({
        symbol: selectedSymbol,
        action: decision.action,
        shares: decision.suggestedShares,
        entryPrice: decision.price,
        stopLoss: decision.stopLoss,
        takeProfit: decision.takeProfit,
      });
      setPhase("done");
      setResult({ message: res.message, success: true });
      queryClient.invalidateQueries({ queryKey: [`/api/autopilot/${selectedSymbol}`] });
    } catch (e: any) {
      setPhase("error");
      setResult({ message: e?.message ?? "Trade execution failed. Please try again.", success: false });
    }
  };

  const handleClosePosition = (id: number, currentPrice: number) => {
    closeMutation.mutate({ id, data: { exitPrice: currentPrice } });
  };

  const actionColor = (a?: string) => {
    if (!a) return "text-muted-foreground";
    const u = a.toUpperCase();
    if (u.includes("BUY")) return "text-bullish";
    if (u.includes("SELL")) return "text-bearish";
    return "text-muted-foreground";
  };

  const symbolPositions = positions?.filter(p => p.symbol === selectedSymbol && p.side === "long") ?? [];

  return (
    <PageTransition>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold">AI Pilot</h1>
            <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-medium">BETA</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Pick any stock or crypto. The AI analyzes everything and decides whether to buy, hold, or sell — then executes for you.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
          {isFetching ? "Analyzing..." : "Refresh analysis"}
        </button>
      </div>

      {error ? <ErrorPanel error={error} /> : isLoading ? <AIPilotSkeleton /> : !decision ? null : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* LEFT: Main Decision */}
          <div className="xl:col-span-2 flex flex-col gap-5">

            {/* AI Background Loading Banner */}
            <AnimatePresence>
              {!aiPowered && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/20 bg-primary/5 text-sm"
                >
                  <RefreshCw className="w-4 h-4 text-primary animate-spin shrink-0" />
                  <span className="text-primary font-medium">Deep AI analysis is running in the background</span>
                  <span className="text-muted-foreground text-xs">— showing quick scan now. Full GPT decision ready in ~30s.</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Decision Hero Card */}
            <Card className={cn(
              "border-2 transition-colors",
              decision.action.includes("BUY") ? "border-bullish/25 bg-bullish/3" :
              decision.action.includes("SELL") ? "border-bearish/25 bg-bearish/3" :
              "border-border"
            )}>
              <div className="p-6 sm:p-8">
                {/* Symbol + Price */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Analyzing</p>
                    <h2 className="text-4xl font-bold font-mono">{selectedSymbol}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xl font-mono font-semibold">{formatPrice(decision.price)}</span>
                      <PriceChange value={decision.change} showIcon />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <ConfidenceRing value={decision.confidence} size={88} />
                    <span className="text-[10px] text-muted-foreground">AI Confidence</span>
                  </div>
                </div>

                {/* AI Decision */}
                <div className="mb-5">
                  <p className="text-xs text-muted-foreground mb-2">AI Decision</p>
                  <ActionBadge action={decision.action} className="text-base px-5 py-3" />
                  {aiPowered && (
                    <span className="ml-3 text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded-lg font-medium inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> GPT-Powered
                    </span>
                  )}
                </div>

                {/* Headline */}
                <p className={cn("text-lg font-semibold leading-snug mb-4", actionColor(decision.action))}>
                  {decision.headline}
                </p>

                {/* Reasoning */}
                <div className="bg-muted/40 rounded-xl p-4 border border-border/40">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What the AI sees</span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{decision.reasoning}</p>
                </div>
              </div>
            </Card>

            {/* What happens next + Risk */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {decision.whatHappensNext && (
                <Card>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What to Expect</span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/80">{decision.whatHappensNext}</p>
                  </div>
                </Card>
              )}
              {decision.riskNote && (
                <Card>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-warning" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Biggest Risk</span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/80">{decision.riskNote}</p>
                  </div>
                </Card>
              )}
            </div>

            {/* Execution Result Banner */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border text-sm font-medium",
                    result.success
                      ? "border-bullish/30 bg-bullish/10 text-bullish"
                      : "border-bearish/30 bg-bearish/10 text-bearish"
                  )}
                >
                  {result.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                  {result.message}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT: Action Panel */}
          <div className="flex flex-col gap-5">

            {/* Trade Plan */}
            <Card>
              <CardHeader>
                <CardTitle>AI Trade Plan</CardTitle>
                <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground">Paper trade</span>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <PlanRow label="Action" value={<ActionBadge action={decision.action} className="text-sm" />} />
                <PlanRow
                  label="Suggested Quantity"
                  value={<span className="font-mono font-bold text-lg">{decision.suggestedShares} shares</span>}
                  sub="Based on ~$1,000 budget"
                />
                <PlanRow
                  label="Buy At (Current Price)"
                  value={<span className="font-mono font-semibold">{formatPrice(decision.price)}</span>}
                />
                <PlanRow
                  label="Stop Loss"
                  value={<span className="font-mono font-semibold text-bearish">{formatPrice(decision.stopLoss)}</span>}
                  sub="AI cuts losses here automatically"
                />
                <PlanRow
                  label="Take Profit Target"
                  value={<span className="font-mono font-semibold text-bullish">{formatPrice(decision.takeProfit)}</span>}
                  sub="AI locks in gains here"
                />
                <PlanRow
                  label="Risk vs Reward"
                  value={<span className="font-mono font-semibold text-primary">{decision.riskReward.toFixed(1)}× reward per $1 risk</span>}
                />
                <div className="pt-2 border-t border-border/50">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Total investment</span>
                    <span className="font-mono">{formatCurrency(decision.suggestedShares * decision.price)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Max possible loss</span>
                    <span className="font-mono text-bearish">{formatCurrency(decision.suggestedShares * (decision.price - decision.stopLoss))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Execute Button */}
            <div className="flex flex-col gap-3">
              {(decision.action === "HOLD") ? (
                <div className="p-4 rounded-xl border border-border bg-muted/30 text-center">
                  <p className="text-sm font-medium text-muted-foreground">AI says: Wait for a better entry.</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">No trade recommended right now. Check back later.</p>
                </div>
              ) : (
                <Btn
                  variant={decision.action.includes("BUY") ? "success" : "danger"}
                  size="xl"
                  className="w-full"
                  onClick={handleExecute}
                  disabled={phase === "executing" || phase === "done"}
                >
                  {phase === "executing" ? (
                    <><RefreshCw className="w-5 h-5 animate-spin" /> Executing...</>
                  ) : phase === "done" ? (
                    <><CheckCircle2 className="w-5 h-5" /> Trade Executed!</>
                  ) : (
                    <><Zap className="w-5 h-5" /> Let AI {decision.action.includes("BUY") ? "Buy" : "Sell"} {selectedSymbol}</>
                  )}
                </Btn>
              )}

              <p className="text-[11px] text-center text-muted-foreground/60 leading-relaxed">
                This is a paper trade — no real money involved. For educational purposes only. Not financial advice.
              </p>
            </div>

            {/* Open Positions for this symbol */}
            {symbolPositions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Your {selectedSymbol} Positions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {symbolPositions.map(pos => (
                    <div key={pos.id} className="p-3 rounded-xl border border-border/50 bg-muted/20 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold">{pos.shares} shares @ {formatPrice(pos.entryPrice)}</span>
                        <span className={cn("text-sm font-bold font-mono", pos.unrealizedPnl >= 0 ? "text-bullish" : "text-bearish")}>
                          {pos.unrealizedPnl >= 0 ? "+" : ""}{formatCurrency(pos.unrealizedPnl)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Now: {formatPrice(pos.currentPrice)}</span>
                        <Btn
                          variant="outline"
                          size="sm"
                          onClick={() => handleClosePosition(pos.id, pos.currentPrice)}
                          disabled={closeMutation.isPending}
                        >
                          Close Position
                        </Btn>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

          </div>
        </div>
      )}
    </PageTransition>
  );
}

function PlanRow({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
      <div className="text-right">{value}</div>
    </div>
  );
}

function AIPilotSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 flex flex-col gap-4">
        <Skeleton className="h-72 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-80" />
        <Skeleton className="h-16" />
      </div>
    </div>
  );
}
