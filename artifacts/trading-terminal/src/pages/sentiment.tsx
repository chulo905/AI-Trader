import React from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { Card, CardHeader, CardTitle, CardContent, PageTransition, Skeleton } from "@/components/terminal-ui";
import { Newspaper, RefreshCw, TrendingUp, TrendingDown, Minus, Sparkles, Users, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetQuote } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SentimentResult {
  symbol: string;
  overallSentiment: "very-bullish" | "bullish" | "neutral" | "bearish" | "very-bearish";
  score: number;
  label: string;
  summary: string;
  keyFactors: string[];
  newsHeadlines: { headline: string; sentiment: "positive" | "neutral" | "negative"; impact: "high" | "medium" | "low" }[];
  socialBuzz: string;
  analystConsensus: string;
  aiPowered: boolean;
  generatedAt: string;
}

const SENTIMENT_COLORS: Record<string, string> = {
  "very-bullish": "text-bullish",
  "bullish": "text-bullish",
  "neutral": "text-muted-foreground",
  "bearish": "text-bearish",
  "very-bearish": "text-bearish",
};

const HEADLINE_COLORS = { positive: "text-bullish", neutral: "text-muted-foreground", negative: "text-bearish" };
const HEADLINE_BG = { positive: "bg-bullish/5 border-bullish/10", neutral: "bg-muted/30 border-border/40", negative: "bg-bearish/5 border-bearish/10" };
const IMPACT_COLORS = { high: "text-primary", medium: "text-muted-foreground", low: "text-muted-foreground/60" };

function SentimentMeter({ score }: { score: number }) {
  const pct = (score / 100) * 100;
  const color = score >= 60 ? "bg-bullish" : score <= 40 ? "bg-bearish" : "bg-amber-500";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Very Bearish</span><span>Neutral</span><span>Very Bullish</span>
      </div>
      <div className="h-3 rounded-full bg-muted relative overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
        <div className="absolute top-0 left-1/2 w-px h-full bg-border/60" />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0</span><span className="font-bold text-foreground">{score}/100</span><span>100</span>
      </div>
    </div>
  );
}

export default function SentimentPage() {
  const { selectedSymbol } = useAppState();
  const { data: quote } = useGetQuote(selectedSymbol, { query: { refetchInterval: 30000 } });

  const { data, isLoading, refetch } = useQuery<SentimentResult>({
    queryKey: ["/api/sentiment", selectedSymbol],
    queryFn: () => customFetch(`${BASE}/api/sentiment/${selectedSymbol}`).then(r => r.json()),
    refetchInterval: 30000,
    placeholderData: {
      symbol: selectedSymbol, overallSentiment: "neutral", score: 0, label: "Neutral", aiPowered: false,
      summary: "Fetching sentiment analysis…", generatedAt: new Date().toISOString(),
      newsHeadlines: [], keyFactors: [], socialBuzz: "—", analystConsensus: "—",
      technicalSignals: { rsi: 50, trend: "Neutral", momentum: "Flat", volatility: "Normal" },
    },
  });

  const sentColor = SENTIMENT_COLORS[data?.overallSentiment ?? "neutral"];

  return (
    <PageTransition>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Newspaper className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">Sentiment & News</h1>
            {data?.aiPowered && <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-semibold"><Sparkles className="w-3 h-3 inline mr-1" />GPT-Powered</span>}
            {!data?.aiPowered && data && <span className="text-xs bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full">Quick Scan</span>}
          </div>
          <p className="text-sm text-muted-foreground">Market sentiment and news analysis for <span className="font-mono font-semibold text-foreground">{selectedSymbol}</span></p>
        </div>
        <button onClick={() => refetch()} className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-xl hover:bg-muted">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {isLoading ? <Skeleton className="h-96" /> : !data ? null : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Overall Sentiment */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center mb-6">
                  <div className={cn("text-5xl font-black mb-2", sentColor)}>{data.label}</div>
                  <p className="text-sm text-muted-foreground">{data.symbol} sentiment score</p>
                </div>
                <SentimentMeter score={data.score} />
                <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{data.summary}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle><Users className="w-4 h-4" /> Social & Analyst</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                    <p className="text-xs text-muted-foreground mb-1">Social Buzz</p>
                    <p className="text-sm">{data.socialBuzz}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                    <p className="text-xs text-muted-foreground mb-1">Analyst Consensus</p>
                    <p className="text-sm">{data.analystConsensus}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle><BarChart2 className="w-4 h-4" /> Key Factors</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {(data?.keyFactors ?? []).map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* News Headlines */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle><Newspaper className="w-4 h-4" /> News Headlines</CardTitle>
                <span className="text-xs text-muted-foreground">{data?.newsHeadlines?.length ?? 0} stories</span>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {(data?.newsHeadlines ?? []).map((item, i) => (
                    <div key={i} className={cn("p-4 rounded-xl border", HEADLINE_BG[item.sentiment])}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {item.sentiment === "positive" ? <TrendingUp className="w-4 h-4 text-bullish mt-0.5 shrink-0" /> : item.sentiment === "negative" ? <TrendingDown className="w-4 h-4 text-bearish mt-0.5 shrink-0" /> : <Minus className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
                          <p className="text-sm font-medium leading-snug">{item.headline}</p>
                        </div>
                        <span className={cn("text-[10px] font-bold uppercase shrink-0", IMPACT_COLORS[item.impact])}>{item.impact}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {!data.aiPowered && (
              <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold text-primary">GPT-powered sentiment is loading</p>
                </div>
                <p className="text-xs text-muted-foreground">Full AI sentiment analysis with realistic news headlines will appear in ~30 seconds. The page auto-updates.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </PageTransition>
  );
}
