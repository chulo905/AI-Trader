import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { Card, CardHeader, CardTitle, CardContent, PageTransition, Skeleton, Btn, ActionBadge } from "@/components/terminal-ui";
import { Bot, Play, Square, Plus, Trash2, RefreshCw, Activity, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AutonomousConfig {
  id: number;
  symbol: string;
  enabled: boolean;
  budgetPerTrade: number;
  maxShares: number;
  intervalMinutes: number;
  lastRunAt: string | null;
  lastAction: string | null;
  lastReason: string | null;
  totalAutoTrades: number;
}

interface LogEntry {
  ts: string;
  symbol: string;
  action: string;
  result: string;
  reason: string;
}

interface StatusData {
  loopRunning: boolean;
  watchedSymbols: number;
  enabledSymbols: number;
  configs: AutonomousConfig[];
  recentLog: LogEntry[];
}

const INTERVAL_OPTIONS = [5, 10, 15, 30, 60];

export default function AutonomousPage() {
  const { selectedSymbol } = useAppState();
  const qc = useQueryClient();
  const [newSymbol, setNewSymbol] = useState(selectedSymbol);
  const [budget, setBudget] = useState("1000");
  const [interval, setInterval_] = useState(15);
  const [showAdd, setShowAdd] = useState(false);

  const { data: status, isLoading } = useQuery<StatusData>({
    queryKey: ["/api/autonomous/status"],
    queryFn: () => customFetch(`${BASE}/api/autonomous/status`).then(r => r.json()),
    refetchInterval: 15000,
  });

  const { data: log } = useQuery<LogEntry[]>({
    queryKey: ["/api/autonomous/log"],
    queryFn: () => customFetch(`${BASE}/api/autonomous/log`).then(r => r.json()),
    refetchInterval: 10000,
  });

  const toggleMutation = useMutation({
    mutationFn: (symbol: string) =>
      customFetch(`${BASE}/api/autonomous/configs/${symbol}/toggle`, { method: "PATCH" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/autonomous/status"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (symbol: string) =>
      customFetch(`${BASE}/api/autonomous/configs/${symbol}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/autonomous/status"] }),
  });

  const addMutation = useMutation({
    mutationFn: (data: object) =>
      customFetch(`${BASE}/api/autonomous/configs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/autonomous/status"] });
      setShowAdd(false);
      setNewSymbol("");
      setBudget("1000");
    },
  });

  const actionColor = (action: string | null) => {
    if (!action) return "text-muted-foreground";
    if (action.includes("BUY")) return "text-bullish";
    if (action.includes("SELL")) return "text-bearish";
    if (action.includes("BLOCKED") || action.includes("ERROR")) return "text-bearish";
    return "text-muted-foreground";
  };

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-2">
        <Bot className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">Autonomous Execution Loop</h1>
        <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold border", status?.loopRunning ? "bg-bullish/10 text-bullish border-bullish/20" : "bg-muted text-muted-foreground border-border")}>
          {status?.loopRunning ? "● Loop Active" : "○ Loop Idle"}
        </span>
      </div>
      <p className="text-sm text-muted-foreground -mt-4 mb-6">The AI monitors your watched symbols on a schedule and executes BUY/SELL trades automatically — no clicks needed.</p>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Watched Symbols", value: status?.watchedSymbols ?? 0, icon: Activity },
          { label: "Auto-Trading Active", value: status?.enabledSymbols ?? 0, icon: Play },
          { label: "Total Auto-Trades", value: (status?.configs ?? []).reduce((s, c) => s + c.totalAutoTrades, 0), icon: TrendingUp },
          { label: "Check Interval", value: "1 min", icon: Clock },
        ].map(stat => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <stat.icon className="w-3.5 h-3.5" />
              <span className="text-xs">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Watched Symbols */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Watched Symbols</CardTitle>
              <Btn variant="secondary" onClick={() => setShowAdd(!showAdd)}>
                <Plus className="w-3.5 h-3.5" /> Add Symbol
              </Btn>
            </CardHeader>
            <CardContent>
              {showAdd && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-4 rounded-sm bg-primary/5 border border-primary/20 flex flex-col gap-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Symbol</label>
                      <input value={newSymbol} onChange={e => setNewSymbol(e.target.value.toUpperCase())} placeholder="AAPL" className="w-full h-9 rounded-sm border border-border bg-muted/40 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Budget/Trade ($)</label>
                      <input type="number" value={budget} onChange={e => setBudget(e.target.value)} className="w-full h-9 rounded-sm border border-border bg-muted/40 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Interval</label>
                      <select value={interval} onChange={e => setInterval_(Number(e.target.value))} className="w-full h-9 rounded-sm border border-border bg-muted/40 px-3 text-sm focus:outline-none">
                        {INTERVAL_OPTIONS.map(o => <option key={o} value={o}>{o} min</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Btn variant="primary" disabled={addMutation.isPending} onClick={() => addMutation.mutate({ symbol: newSymbol, budgetPerTrade: parseFloat(budget), intervalMinutes: interval, enabled: true })}>
                      <Play className="w-3.5 h-3.5" /> Start Auto-Trading
                    </Btn>
                    <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
                  </div>
                </motion.div>
              )}

              {isLoading ? <Skeleton className="h-32" /> : !status?.configs?.length ? (
                <div className="py-10 text-center">
                  <Bot className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No symbols configured. Add one to start auto-trading.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {status.configs.map(cfg => (
                    <div key={cfg.symbol} className="flex items-center justify-between p-4 rounded-sm border border-border/50 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-2 h-2 rounded-full", cfg.enabled ? "bg-bullish animate-pulse" : "bg-muted-foreground")} />
                        <div>
                          <p className="font-mono font-bold">{cfg.symbol}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(cfg.budgetPerTrade)}/trade · every {cfg.intervalMinutes}min · {cfg.totalAutoTrades} trades</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right hidden md:block">
                          <p className={cn("text-xs font-semibold", actionColor(cfg.lastAction))}>{cfg.lastAction ?? "Waiting..."}</p>
                          <p className="text-[10px] text-muted-foreground">{cfg.lastRunAt ? new Date(cfg.lastRunAt).toLocaleTimeString() : "Never run"}</p>
                        </div>
                        <button onClick={() => toggleMutation.mutate(cfg.symbol)} className={cn("text-xs px-3 py-1.5 rounded-sm font-semibold border transition-all", cfg.enabled ? "bg-bullish/10 text-bullish border-bullish/20 hover:bg-bullish/20" : "bg-muted text-muted-foreground border-border hover:bg-muted/80")}>
                          {cfg.enabled ? <><Square className="w-3 h-3 inline mr-1" />Stop</> : <><Play className="w-3 h-3 inline mr-1" />Start</>}
                        </button>
                        <button onClick={() => deleteMutation.mutate(cfg.symbol)} className="text-muted-foreground hover:text-bearish transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* How It Works */}
          <Card>
            <CardHeader><CardTitle>How the Loop Works</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { step: "1", title: "Monitor", desc: "Every minute, the server checks if any symbol is due for analysis based on your interval setting." },
                  { step: "2", title: "Analyze", desc: "Technical indicators (RSI, MACD, SMA) are computed. Risk rules are checked before any action." },
                  { step: "3", title: "Execute", desc: "If signals confirm BUY or SELL, the trade is executed automatically with stop-loss and take-profit set." },
                ].map(item => (
                  <div key={item.step} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">{item.step}</div>
                    <div>
                      <p className="font-semibold text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-start gap-2 p-3 rounded-sm bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">This is paper trading only. No real money is used. All trades are simulated with virtual funds.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Execution Log */}
        <Card>
          <CardHeader>
            <CardTitle>Execution Log</CardTitle>
            <button onClick={() => qc.invalidateQueries({ queryKey: ["/api/autonomous/log"] })} className="text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </CardHeader>
          <CardContent>
            {!log?.length ? (
              <div className="py-8 text-center">
                <Activity className="w-6 h-6 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No executions yet. The loop will log actions here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto">
                {log.map((entry, i) => (
                  <div key={i} className="p-3 rounded-sm bg-muted/30 border border-border/40">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-xs">{entry.symbol}</span>
                      <span className={cn("text-xs font-semibold", actionColor(entry.action))}>{entry.action}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{entry.reason}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(entry.ts).toLocaleTimeString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
