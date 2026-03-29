import { useGetTradeIdeas } from "@workspace/api-client-react";
import { TerminalCard, PageTransition, TerminalSkeleton, ErrorPanel, SignalBadge, TerminalButton } from "@/components/terminal-ui";
import { Lightbulb, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useAppState } from "@/hooks/use-app-state";

export default function TradeIdeasPage() {
  const { data: ideas, isLoading, error } = useGetTradeIdeas({ limit: 20 });
  const { setSelectedSymbol } = useAppState();

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-6">
        <Lightbulb className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">AI Trade Ideas</h1>
      </div>

      {error ? <ErrorPanel error={error} /> : isLoading ? <TerminalSkeleton className="h-[800px]" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {ideas?.map(idea => (
            <TerminalCard key={idea.id} className="group hover:border-primary/50 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col">
                  <span className="text-2xl font-bold font-mono text-foreground">{idea.symbol}</span>
                  <span className="text-xs text-muted-foreground">{new Date(idea.generatedAt).toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <SignalBadge signal={idea.side} />
                  <span className="text-xs font-mono font-medium bg-muted px-2 py-1 rounded text-primary">R:R {idea.riskReward.toFixed(1)}</span>
                </div>
              </div>

              <div className="bg-background rounded-sm border border-border/50 p-3 mb-4 flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm font-mono border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">ENTRY</span>
                  <span className="font-bold">{idea.entryZone}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-mono border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">TARGET</span>
                  <span className="text-bullish font-bold">{idea.targetZone}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-mono">
                  <span className="text-muted-foreground">STOP LOSS</span>
                  <span className="text-bearish font-bold">{idea.stopZone}</span>
                </div>
              </div>

              <div className="text-sm text-foreground/80 leading-relaxed mb-6">
                {idea.rationale}
              </div>

              <div className="mt-auto pt-4 border-t border-border/50 flex justify-between items-center">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-muted-foreground">CONFIDENCE:</span>
                  <span className={idea.confidence > 75 ? "text-primary" : "text-foreground"}>{idea.confidence}%</span>
                </div>
                <Link href="/trade">
                  <TerminalButton variant="outline" size="sm" onClick={() => setSelectedSymbol(idea.symbol)} className="group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary">
                    Trade Idea <ArrowRight className="w-3 h-3 ml-2" />
                  </TerminalButton>
                </Link>
              </div>
            </TerminalCard>
          ))}
          {!ideas?.length && (
            <div className="col-span-full p-12 text-center text-muted-foreground border border-dashed border-border rounded-sm">
              No active trade ideas at the moment. Check back later.
            </div>
          )}
        </div>
      )}
    </PageTransition>
  );
}
