import { useGetAnalysis } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { TerminalCard, PageTransition, TerminalSkeleton, ErrorPanel, SignalBadge, TerminalTable } from "@/components/terminal-ui";
import { formatPrice } from "@/lib/utils";
import { Brain, Target, Activity, Zap, RefreshCw, TrendingUp, TrendingDown, Minus, BarChart2, AlertTriangle, Sparkles, XCircle, Eye, ChevronRight, Clock } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";
import type { ExtendedIndicators } from "@/hooks/use-autopilot";

interface DetectedPattern {
  type: string;
  direction: string;
  confidence: number;
  description: string;
  keyLevel?: number;
}

interface Divergence {
  type: string | null;
  strength: string | null;
  description: string | null;
}

interface SupportResistance {
  pivotPoint: number | null;
  r1: number | null;
  r2: number | null;
  s1: number | null;
  s2: number | null;
}

interface AnalysisExtra {
  aiPowered?: boolean;
  extended?: ExtendedIndicators;
  detectedPatterns?: DetectedPattern[];
  divergence?: Divergence;
  supportResistance?: SupportResistance;
}

interface ChronosForecast {
  direction: "bullish" | "bearish" | "neutral";
  forecastPct: number;
  confidenceLow: number;
  confidenceHigh: number;
  horizon: number;
  generatedAt: string;
}

function AIPriceForecastCard({ symbol }: { symbol: string }) {
  const { data: forecast, isLoading, error } = useQuery<ChronosForecast>({
    queryKey: [`/api/market/${symbol}/forecast`],
    queryFn: () => customFetch<ChronosForecast>(`/api/market/${symbol}/forecast`),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <TerminalCard>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          <h3 className="font-semibold uppercase text-xs tracking-widest text-muted-foreground">AI Price Forecast</h3>
        </div>
        <div className="animate-pulse flex flex-col gap-2">
          <div className="h-8 bg-muted/30 rounded" />
          <div className="h-4 bg-muted/20 rounded w-3/4" />
        </div>
      </TerminalCard>
    );
  }

  if (error || !forecast) {
    return (
      <TerminalCard className="border-muted/30">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold uppercase text-xs tracking-widest text-muted-foreground">AI Price Forecast</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Chronos forecast unavailable. Set <span className="font-mono text-primary">HUGGINGFACE_API_TOKEN</span> to enable AI forecasting.
        </p>
      </TerminalCard>
    );
  }

  const isBullish = forecast.direction === "bullish";
  const isBearish = forecast.direction === "bearish";
  const directionColor = isBullish ? "text-bullish" : isBearish ? "text-bearish" : "text-amber-400";
  const borderColor = isBullish ? "border-bullish/20 bg-bullish/5" : isBearish ? "border-bearish/20 bg-bearish/5" : "border-amber-400/20 bg-amber-400/5";

  const sign = (n: number) => (n >= 0 ? "+" : "");

  return (
    <TerminalCard className={cn(borderColor)}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="font-semibold uppercase text-xs tracking-widest text-muted-foreground">AI Price Forecast</h3>
        <span className="ml-auto text-xs font-mono text-muted-foreground">{forecast.horizon}-bar ahead</span>
      </div>

      <div className="flex items-center gap-3 mb-3">
        {isBullish ? (
          <TrendingUp className={cn("w-8 h-8", directionColor)} />
        ) : isBearish ? (
          <TrendingDown className={cn("w-8 h-8", directionColor)} />
        ) : (
          <Minus className={cn("w-8 h-8", directionColor)} />
        )}
        <div>
          <div className={cn("text-2xl font-bold font-mono", directionColor)}>
            {sign(forecast.forecastPct)}{forecast.forecastPct.toFixed(2)}%
          </div>
          <div className="text-xs text-muted-foreground capitalize font-semibold">{forecast.direction}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-muted-foreground mb-1">95% CI</div>
          <div className="font-mono text-xs">
            <span className="text-bearish">{sign(forecast.confidenceLow)}{forecast.confidenceLow.toFixed(2)}%</span>
            <span className="text-muted-foreground"> / </span>
            <span className="text-bullish">{sign(forecast.confidenceHigh)}{forecast.confidenceHigh.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground border-t border-border/30 pt-2 flex items-center gap-1">
        <Brain className="w-3 h-3" />
        Powered by Amazon Chronos · {new Date(forecast.generatedAt).toLocaleTimeString()}
      </div>
    </TerminalCard>
  );
}

function AnalysisPageInner() {
  const { selectedSymbol } = useAppState();
  const queryClient = useQueryClient();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: analysisRaw, isLoading, error } = useGetAnalysis(selectedSymbol, { timeframe: '1d' }, {
    query: { staleTime: 5 * 60 * 1000, retry: 1 },
  });
  const analysis = analysisRaw as (typeof analysisRaw & AnalysisExtra) | undefined;

  const aiPowered = analysis?.aiPowered === true;

  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    if (analysis && !aiPowered) {
      pollingRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/analysis/${selectedSymbol}`] });
      }, 15_000);
    }

    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [analysis, aiPowered, selectedSymbol, queryClient]);

  const extendedIndicators = analysis?.extended;

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-6">
        <Brain className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">AI Analysis: {selectedSymbol}</h1>
      </div>

      {error ? <ErrorPanel error={error} /> : isLoading ? <TerminalSkeleton className="h-[800px]" /> : !analysis ? null : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {!aiPowered && (
            <div className="lg:col-span-3 flex items-center gap-3 px-4 py-3 rounded-sm border border-primary/30 bg-primary/5 text-sm">
              <RefreshCw className="w-4 h-4 text-primary animate-spin" />
              <span className="text-primary font-medium">GPT analysis is computing in the background —</span>
              <span className="text-muted-foreground">showing computed indicator results now. Page auto-refreshes every 15s.</span>
            </div>
          )}

          {/* Main Overview */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <TerminalCard className="bg-primary/5 border-primary/20">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">Directional Bias</h2>
                  <div className="flex items-center gap-3 flex-wrap">
                    <SignalBadge signal={analysis.bias} className="px-4 py-2 text-base" />
                    {(analysis as any).grade && (
                      <AnalysisGradeBadge grade={(analysis as any).grade} />
                    )}
                    <div className="flex items-center gap-2 font-mono text-sm">
                      <span className="text-muted-foreground">Confidence:</span>
                      <span className="text-primary font-bold">{analysis.confidence}%</span>
                    </div>
                    {aiPowered && (
                      <span className="flex items-center gap-1 text-xs font-mono bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded-full">
                        <Brain className="w-3 h-3" /> GPT-Powered
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground font-mono text-right">
                  Generated At<br/>
                  {new Date(analysis.generatedAt).toLocaleString()}
                </div>
              </div>

              <div className="text-lg leading-relaxed text-foreground/90 border-l-2 border-primary pl-4 py-1">
                {analysis.summary}
              </div>
            </TerminalCard>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TerminalCard className="p-4">
                <div className="flex items-center gap-2 mb-2 text-primary">
                  <TrendingIcon val={analysis.trend} />
                  <span className="font-semibold uppercase text-xs">Trend</span>
                </div>
                <div className="text-sm">{analysis.trend}</div>
              </TerminalCard>
              <TerminalCard className="p-4">
                <div className="flex items-center gap-2 mb-2 text-primary">
                  <Zap className="w-4 h-4" />
                  <span className="font-semibold uppercase text-xs">Momentum</span>
                </div>
                <div className="text-sm">{analysis.momentum}</div>
              </TerminalCard>
              <TerminalCard className="p-4">
                <div className="flex items-center gap-2 mb-2 text-primary">
                  <Activity className="w-4 h-4" />
                  <span className="font-semibold uppercase text-xs">Volatility</span>
                </div>
                <div className="text-sm">{analysis.volatility}</div>
              </TerminalCard>
            </div>

            {/* Bull Case / Bear Case */}
            {aiPowered && ((analysis as any).bullCase || (analysis as any).bearCase) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(analysis as any).bullCase && (
                  <div className="p-4 rounded-sm border border-bullish/25 bg-bullish/5">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-bullish" />
                      <span className="text-xs font-bold text-bullish/80 uppercase tracking-widest">Bull Case</span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/80">{(analysis as any).bullCase}</p>
                  </div>
                )}
                {(analysis as any).bearCase && (
                  <div className="p-4 rounded-sm border border-bearish/25 bg-bearish/5">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className="w-4 h-4 text-bearish" />
                      <span className="text-xs font-bold text-bearish/80 uppercase tracking-widest">Bear Case</span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/80">{(analysis as any).bearCase}</p>
                  </div>
                )}
              </div>
            )}

            <TerminalCard title="Technical Signals">
              <TerminalTable headers={["Indicator", "Value", "Interpretation"]}>
                {analysis.signals.map((sig, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-semibold">{sig.name}</td>
                    <td className="px-4 py-3 font-mono">{sig.value}</td>
                    <td className="px-4 py-3">
                      <span className={cn("font-semibold", {
                        "text-bullish": sig.interpretation === "Bullish" || sig.interpretation === "Oversold" || sig.interpretation === "High Conviction",
                        "text-bearish": sig.interpretation === "Bearish" || sig.interpretation === "Overbought",
                        "text-amber-400": sig.interpretation === "Squeeze" || sig.interpretation === "Neutral",
                        "text-muted-foreground": !["Bullish","Bearish","Oversold","Overbought","High Conviction","Squeeze","Neutral"].includes(sig.interpretation),
                      })}>{sig.interpretation}</span>
                    </td>
                  </tr>
                ))}
              </TerminalTable>
            </TerminalCard>

            {/* Extended Indicators: Williams %R, CCI, Aroon */}
            {extendedIndicators && (extendedIndicators.williamsR != null || extendedIndicators.cci != null || extendedIndicators.aroon != null) && (
              <TerminalCard>
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold uppercase text-xs tracking-widest text-muted-foreground">Extended Indicators</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {extendedIndicators.williamsR != null && (
                    <div className="p-3 rounded-sm border border-border/50 bg-background/50">
                      <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Williams %R</div>
                      <div className={cn("text-lg font-mono font-bold", extendedIndicators.williamsR >= -20 ? "text-bearish" : extendedIndicators.williamsR <= -80 ? "text-bullish" : "text-foreground")}>
                        {extendedIndicators.williamsR}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {extendedIndicators.williamsR >= -20 ? "Overbought" : extendedIndicators.williamsR <= -80 ? "Oversold" : "Neutral"} · Range: 0 to -100
                      </div>
                    </div>
                  )}
                  {extendedIndicators.cci != null && (
                    <div className="p-3 rounded-sm border border-border/50 bg-background/50">
                      <div className="text-xs text-muted-foreground uppercase font-bold mb-1">CCI (20)</div>
                      <div className={cn("text-lg font-mono font-bold", extendedIndicators.cci >= 100 ? "text-bearish" : extendedIndicators.cci <= -100 ? "text-bullish" : "text-foreground")}>
                        {extendedIndicators.cci}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {extendedIndicators.cci >= 100 ? "Overbought" : extendedIndicators.cci <= -100 ? "Oversold" : "Normal range (±100)"}
                      </div>
                    </div>
                  )}
                  {extendedIndicators.aroon && (
                    <div className="p-3 rounded-sm border border-border/50 bg-background/50">
                      <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Aroon (25)</div>
                      <div className="flex gap-2 items-baseline">
                        <span className="text-bullish font-mono font-bold">{extendedIndicators.aroon.aroonUp}</span>
                        <span className="text-muted-foreground text-xs">/</span>
                        <span className="text-bearish font-mono font-bold">{extendedIndicators.aroon.aroonDown}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 capitalize">
                        Osc: {extendedIndicators.aroon.aroonOscillator > 0 ? "+" : ""}{extendedIndicators.aroon.aroonOscillator} · {extendedIndicators.aroon.trend.replace(/-/g, " ")}
                      </div>
                    </div>
                  )}
                </div>
              </TerminalCard>
            )}

            {/* Chart Patterns Section */}
            {(() => {
              const patterns = analysis?.detectedPatterns;
              const divergence = analysis?.divergence;
              const hasContent = (patterns && patterns.length > 0) || divergence?.type;
              if (!hasContent) return null;
              return (
                <TerminalCard>
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart2 className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold uppercase text-xs tracking-widest text-muted-foreground">Chart Pattern Analysis</h3>
                  </div>
                  <div className="flex flex-col gap-3">
                    {patterns && patterns.map((p, i) => (
                      <div key={i} className={cn(
                        "p-3 rounded-sm border relative overflow-hidden",
                        p.direction === "bullish" ? "border-bullish/30 bg-bullish/5" : "border-bearish/30 bg-bearish/5"
                      )}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${p.direction === "bullish" ? "bg-bullish" : "bg-bearish"}`} />
                        <div className="pl-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold uppercase tracking-widest">{p.type.replace(/-/g, " ")}</span>
                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs font-mono font-bold", p.direction === "bullish" ? "text-bullish" : "text-bearish")}>
                                {p.direction === "bullish" ? <TrendingUp className="w-3 h-3 inline mr-1" /> : <TrendingDown className="w-3 h-3 inline mr-1" />}
                                {p.direction.toUpperCase()}
                              </span>
                              <span className="text-xs font-mono text-muted-foreground">{p.confidence}%</span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                          {p.keyLevel && (
                            <div className="mt-2 text-xs font-mono">
                              <span className="text-muted-foreground">Key Level: </span>
                              <span className="font-bold">{formatPrice(p.keyLevel)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {divergence?.type && divergence.description && (
                      <div className={cn(
                        "p-3 rounded-sm border relative overflow-hidden",
                        divergence.type === "bullish" ? "border-bullish/30 bg-bullish/5" : "border-bearish/30 bg-bearish/5"
                      )}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${divergence.type === "bullish" ? "bg-bullish" : "bg-bearish"}`} />
                        <div className="pl-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold uppercase tracking-widest">RSI Divergence</span>
                            <span className={cn("text-xs font-mono font-bold uppercase", divergence.type === "bullish" ? "text-bullish" : "text-bearish")}>
                              {divergence.strength} {divergence.type}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{divergence.description}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </TerminalCard>
              );
            })()}
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-6">

            {/* AI Price Forecast */}
            <AIPriceForecastCard symbol={selectedSymbol} />

            {/* Invalidation Level + Trade Plan */}
            {aiPowered && (analysis as any).invalidationLevel && (
              <div className="rounded-sm border border-warning/30 bg-warning/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-warning" />
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Invalidation Level</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">Trade thesis fails if price breaks:</p>
                <p className="text-2xl font-mono font-bold text-warning tabular-nums">
                  {formatPrice((analysis as any).invalidationLevel)}
                </p>
              </div>
            )}
            {aiPowered && (analysis as any).tradePlan && (
              <TerminalCard>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold uppercase text-xs tracking-widest text-muted-foreground">AI Trade Plan</h3>
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    { label: "Entry", value: (analysis as any).tradePlan.entry, color: "text-foreground" },
                    { label: "Stop", value: (analysis as any).tradePlan.stop, color: "text-bearish" },
                    { label: "Target 1", value: (analysis as any).tradePlan.target1, color: "text-bullish" },
                    { label: "Target 2", value: (analysis as any).tradePlan.target2, color: "text-bullish" },
                  ].map(({ label, value, color }) => value && (
                    <div key={label} className="flex justify-between items-center text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
                      <span className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">{label}</span>
                      <span className={cn("font-mono font-bold tabular-nums", color)}>{formatPrice(value)}</span>
                    </div>
                  ))}
                  {(analysis as any).tradePlan?.rrRatio && (
                    <div className="mt-1 pt-2 border-t border-border flex justify-between">
                      <span className="text-xs text-muted-foreground">Risk/Reward</span>
                      <span className={cn("font-mono font-bold text-sm",
                        (analysis as any).tradePlan.rrRatio >= 2.5 ? "text-bullish" :
                        (analysis as any).tradePlan.rrRatio >= 1.5 ? "text-foreground" :
                        "text-bearish"
                      )}>{(analysis as any).tradePlan.rrRatio.toFixed(1)}×</span>
                    </div>
                  )}
                </div>
              </TerminalCard>
            )}

            <TerminalCard title="Key Price Levels">
              <div className="flex flex-col gap-3">
                {analysis.keyLevels.map((lvl, i) => (
                  <div key={i} className="flex flex-col p-3 rounded-sm border border-border/50 bg-background/50 relative overflow-hidden">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                      lvl.type === 'resistance' || lvl.type === 'stop' ? 'bg-bearish' :
                      lvl.type === 'support' ? 'bg-bullish' : 'bg-primary'
                    }`} />
                    <div className="flex justify-between items-center pl-2">
                      <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">{lvl.type}</span>
                      <span className="font-mono text-lg font-bold">{formatPrice(lvl.price)}</span>
                    </div>
                    {lvl.description && <span className="text-xs text-muted-foreground mt-1 pl-2">{lvl.description}</span>}
                  </div>
                ))}
              </div>
            </TerminalCard>

            {/* Pivot Points */}
            {(() => {
              const sr = analysis?.supportResistance;
              if (!sr?.pivotPoint) return null;
              return (
                <TerminalCard>
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold uppercase text-xs tracking-widest text-muted-foreground">Daily Pivot Points</h3>
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-center">
                    {[
                      { label: "S2", value: sr.s2, color: "text-bearish" },
                      { label: "S1", value: sr.s1, color: "text-bearish/70" },
                      { label: "PP", value: sr.pivotPoint, color: "text-primary" },
                      { label: "R1", value: sr.r1, color: "text-bullish/70" },
                      { label: "R2", value: sr.r2, color: "text-bullish" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className={cn("text-xs font-mono font-bold", color)}>{value ? formatPrice(value) : "—"}</span>
                      </div>
                    ))}
                  </div>
                </TerminalCard>
              );
            })()}

            <TerminalCard className="bg-amber-500/5 border-amber-500/20 text-amber-500/80 p-4">
              <h4 className="font-bold text-sm uppercase mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Disclaimer
              </h4>
              <p className="text-xs leading-relaxed">
                AI analysis is for informational and paper trading purposes only. Not financial advice. Always verify technical patterns independently.
              </p>
            </TerminalCard>
          </div>

        </div>
      )}
    </PageTransition>
  );
}

function AnalysisGradeBadge({ grade }: { grade: string }) {
  const color =
    grade === "A+" ? "border-bullish/60 text-bullish bg-bullish/10" :
    grade === "A"  ? "border-bullish/40 text-bullish bg-bullish/8" :
    grade === "B"  ? "border-primary/40 text-primary bg-primary/8" :
    grade === "C"  ? "border-yellow-500/40 text-yellow-400 bg-yellow-500/8" :
    grade === "D"  ? "border-orange-500/40 text-orange-400 bg-orange-500/8" :
                    "border-bearish/40 text-bearish bg-bearish/8";
  return (
    <span className={cn("inline-flex items-center border rounded-sm px-3 py-1.5 text-sm font-bold font-mono uppercase tracking-widest", color)}>
      Setup: {grade}
    </span>
  );
}

function TrendingIcon({ val }: { val: string }) {
  const v = val.toLowerCase();
  if (v.includes('bull') || v.includes('up')) return <Activity className="w-4 h-4 text-bullish" />;
  if (v.includes('bear') || v.includes('down')) return <Activity className="w-4 h-4 text-bearish" />;
  return <Activity className="w-4 h-4 text-neutral" />;
}

export default function AnalysisPage() {
  return (
    <ErrorBoundary label="AnalysisPage">
      <AnalysisPageInner />
    </ErrorBoundary>
  );
}
