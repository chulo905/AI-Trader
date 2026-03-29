import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { Card, CardHeader, CardTitle, CardContent, PageTransition, Skeleton, Btn } from "@/components/terminal-ui";
import { FlaskConical, TrendingUp, TrendingDown, Target, ArrowUpDown, Trophy, AlertTriangle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const PERIODS = ["1M", "3M", "6M", "1Y"] as const;

interface BacktestResult {
  symbol: string;
  period: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  totalReturnPct: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgHoldingDays: number;
  bestTrade: number;
  worstTrade: number;
  equity: number[];
  trades: {
    entryDate: string;
    exitDate: string;
    entryPrice: number;
    exitPrice: number;
    shares: number;
    pnl: number;
    pnlPct: number;
    holdingDays: number;
    reason: string;
  }[];
  summary: string;
}

function MiniEquityCurve({ equity }: { equity: number[] }) {
  if (!equity || equity.length < 2) return null;
  const min = Math.min(...equity);
  const max = Math.max(...equity);
  const range = max - min || 1;
  const w = 300;
  const h = 80;
  const pts = equity.map((v, i) => `${(i / (equity.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  const lastVal = equity[equity.length - 1]!;
  const firstVal = equity[0]!;
  const positive = lastVal >= firstVal;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={positive ? "hsl(155 72% 45%)" : "hsl(355 80% 60%)"} strokeWidth="2" />
    </svg>
  );
}

export default function BacktestingPage() {
  const { selectedSymbol } = useAppState();
  const [symbol, setSymbol] = useState(selectedSymbol);
  const [runSymbol, setRunSymbol] = useState<string | null>(null);
  const [period, setPeriod] = useState<typeof PERIODS[number]>("3M");
  const [runPeriod, setRunPeriod] = useState<string>("3M");

  const { data, isLoading, error } = useQuery<BacktestResult>({
    queryKey: ["/api/backtest", runSymbol, runPeriod],
    queryFn: () => customFetch(`${BASE}/api/backtest/${runSymbol}?period=${runPeriod}`).then(r => r.json()),
    enabled: !!runSymbol,
  });

  const run = () => {
    setRunSymbol(symbol.toUpperCase());
    setRunPeriod(period);
  };

  const positive = (data?.totalReturnPct ?? 0) >= 0;

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-2">
        <FlaskConical className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">Backtesting</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-4 mb-6">Simulate the AI's technical strategy on historical data before trusting it with real trades.</p>

      {/* Controls */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Symbol</label>
              <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" className="h-9 w-32 rounded-sm border border-border bg-muted/40 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Period</label>
              <div className="flex bg-muted/50 p-1 rounded-sm border border-border/50">
                {PERIODS.map(p => (
                  <button key={p} onClick={() => setPeriod(p)} className={cn("px-4 py-1.5 text-xs font-mono rounded-sm transition-all", period === p ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <Btn variant="primary" onClick={run} disabled={isLoading}>
              <FlaskConical className="w-4 h-4" /> {isLoading ? "Running..." : "Run Backtest"}
            </Btn>
          </div>
        </CardContent>
      </Card>

      {!runSymbol && (
        <div className="py-16 text-center">
          <FlaskConical className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground">Enter a symbol and run a backtest to see historical performance.</p>
        </div>
      )}

      {isLoading && <Skeleton className="h-96" />}

      {error && (
        <div className="p-6 rounded-sm bg-bearish/10 border border-bearish/20 text-center">
          <AlertTriangle className="w-8 h-8 text-bearish mx-auto mb-2" />
          <p className="text-bearish">Backtest failed. Try a different period or symbol.</p>
        </div>
      )}

      {data && !isLoading && (
        <div className="flex flex-col gap-6">
          {/* Summary */}
          <div className="p-4 rounded-sm border border-border/50 bg-muted/20">
            <p className="text-sm text-muted-foreground">{data.summary}</p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: "Total Return", value: `${data.totalReturnPct >= 0 ? "+" : ""}${data.totalReturnPct.toFixed(1)}%`, bull: data.totalReturnPct > 0 },
              { label: "Win Rate", value: `${data.winRate.toFixed(0)}%`, bull: data.winRate > 50 },
              { label: "Total Trades", value: data.totalTrades, bull: null },
              { label: "Sharpe Ratio", value: data.sharpeRatio.toFixed(2), bull: data.sharpeRatio > 1 },
              { label: "Max Drawdown", value: `${data.maxDrawdown.toFixed(1)}%`, bull: data.maxDrawdown < 10 },
              { label: "Profit Factor", value: data.profitFactor.toFixed(2), bull: data.profitFactor > 1 },
              { label: "Avg Win", value: formatCurrency(data.avgWin), bull: true },
              { label: "Avg Loss", value: formatCurrency(data.avgLoss), bull: false },
            ].map(m => (
              <Card key={m.label} className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">{m.label}</p>
                <p className={cn("text-lg font-bold", m.bull === true ? "text-bullish" : m.bull === false ? "text-bearish" : "")}>{m.value}</p>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Equity Curve */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Equity Curve</CardTitle>
                  <span className={cn("text-sm font-mono font-bold", positive ? "text-bullish" : "text-bearish")}>
                    {positive ? "+" : ""}{data.totalReturnPct.toFixed(1)}%
                  </span>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/30 rounded-sm p-4">
                    <MiniEquityCurve equity={data.equity} />
                  </div>
                  <div className="flex justify-between mt-3 text-xs text-muted-foreground font-mono">
                    <span>$100,000 start</span>
                    <span className={cn("font-bold", positive ? "text-bullish" : "text-bearish")}>{formatCurrency(data.equity[data.equity.length - 1] ?? 100000)} end</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="text-center p-3 rounded-sm bg-muted/30">
                      <p className="text-xs text-muted-foreground">Best Trade</p>
                      <p className="text-sm font-bold text-bullish">+{formatCurrency(data.bestTrade)}</p>
                    </div>
                    <div className="text-center p-3 rounded-sm bg-muted/30">
                      <p className="text-xs text-muted-foreground">Avg Hold</p>
                      <p className="text-sm font-bold">{data.avgHoldingDays.toFixed(1)}d</p>
                    </div>
                    <div className="text-center p-3 rounded-sm bg-muted/30">
                      <p className="text-xs text-muted-foreground">Worst Trade</p>
                      <p className="text-sm font-bold text-bearish">{formatCurrency(data.worstTrade)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Trade History */}
            <Card>
              <CardHeader>
                <CardTitle>Last {data.trades.length} Trades</CardTitle>
                <span className="text-xs text-muted-foreground">{data.winningTrades}W / {data.losingTrades}L</span>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto">
                  {data.trades.map((t, i) => (
                    <div key={i} className={cn("flex items-center justify-between px-3 py-2 rounded-sm text-xs", t.pnl >= 0 ? "bg-bullish/5 border border-bullish/10" : "bg-bearish/5 border border-bearish/10")}>
                      <div>
                        <p className="font-mono font-semibold">{t.reason}</p>
                        <p className="text-muted-foreground">{t.holdingDays}d · {t.shares} shares</p>
                      </div>
                      <span className={cn("font-mono font-bold", t.pnl >= 0 ? "text-bullish" : "text-bearish")}>
                        {t.pnl >= 0 ? "+" : ""}{formatCurrency(t.pnl)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
