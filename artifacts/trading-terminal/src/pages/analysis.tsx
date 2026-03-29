import { useGetAnalysis } from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { TerminalCard, PageTransition, TerminalSkeleton, ErrorPanel, SignalBadge, DataPoint, TerminalTable } from "@/components/terminal-ui";
import { formatPrice } from "@/lib/utils";
import { Brain, Target, Activity, Zap, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

export default function AnalysisPage() {
  const { selectedSymbol } = useAppState();
  const queryClient = useQueryClient();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: analysis, isLoading, error } = useGetAnalysis(selectedSymbol, { timeframe: '1d' }, {
    query: { staleTime: 5 * 60 * 1000, retry: 1 },
  });

  const aiPowered = (analysis as any)?.aiPowered === true;

  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    if (analysis && !aiPowered) {
      pollingRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/analysis/${selectedSymbol}`] });
      }, 15_000);
    }

    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [analysis, aiPowered, selectedSymbol, queryClient]);

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-6">
        <Brain className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">AI Analysis: {selectedSymbol}</h1>
      </div>

      {error ? <ErrorPanel error={error} /> : isLoading ? <TerminalSkeleton className="h-[800px]" /> : !analysis ? null : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {!aiPowered && (
            <div className="lg:col-span-3 flex items-center gap-3 px-4 py-3 rounded-lg border border-primary/30 bg-primary/5 text-sm">
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
                  <div className="flex items-center gap-4 flex-wrap">
                    <SignalBadge signal={analysis.bias} className="px-4 py-2 text-base" />
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

            <TerminalCard title="Technical Signals">
              <TerminalTable headers={["Indicator", "Value", "Interpretation"]}>
                {analysis.signals.map((sig, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-semibold">{sig.name}</td>
                    <td className="px-4 py-3 font-mono">{sig.value}</td>
                    <td className="px-4 py-3 text-muted-foreground">{sig.interpretation}</td>
                  </tr>
                ))}
              </TerminalTable>
            </TerminalCard>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <TerminalCard title="Key Price Levels">
              <div className="flex flex-col gap-3">
                {analysis.keyLevels.map((lvl, i) => (
                  <div key={i} className="flex flex-col p-3 rounded-lg border border-border/50 bg-background/50 relative overflow-hidden">
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

            <TerminalCard className="bg-amber-500/5 border-amber-500/20 text-amber-500/80 p-4">
              <h4 className="font-bold text-sm uppercase mb-2 flex items-center gap-2">
                <Target className="w-4 h-4" /> Disclaimer
              </h4>
              <p className="text-xs leading-relaxed">
                AI analysis is provided for informational and paper trading purposes only. It does not constitute financial advice. Always verify technical patterns independently.
              </p>
            </TerminalCard>
          </div>

        </div>
      )}
    </PageTransition>
  );
}

function TrendingIcon({ val }: { val: string }) {
  const v = val.toLowerCase();
  if (v.includes('bull') || v.includes('up')) return <Activity className="w-4 h-4 text-bullish" />;
  if (v.includes('bear') || v.includes('down')) return <Activity className="w-4 h-4 text-bearish" />;
  return <Activity className="w-4 h-4 text-neutral" />;
}
