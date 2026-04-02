import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Play, RefreshCw, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronUp, Brain, AlertCircle, Clock, BarChart2,
  Zap, MessageSquare,
} from "lucide-react";
import {
  Card, CardHeader, CardTitle, CardContent, PageTransition, Skeleton,
} from "@/components/terminal-ui";
import { cn, formatCurrency } from "@/lib/utils";
import { useAppState } from "@/hooks/use-app-state";
import { useLatestSwarm, useRunSwarm, useSwarmHistory, type AgentVote, type SwarmResult, type SwarmHistoryItem } from "@/hooks/use-mirofish";

const AGENT_COLORS: Record<string, string> = {
  warren:  "hsl(38 92% 50%)",
  kira:    "hsl(210 90% 56%)",
  maya:    "hsl(262 83% 58%)",
  tyler:   "hsl(155 72% 45%)",
  sophia:  "hsl(355 80% 60%)",
  alex:    "hsl(185 84% 44%)",
  jordan:  "hsl(43 96% 56%)",
  ethan:   "hsl(24 95% 53%)",
  luna:    "hsl(300 70% 60%)",
  quant:   "hsl(220 70% 60%)",
};

const AGENT_INITIALS: Record<string, string> = {
  warren: "W", kira: "K", maya: "M", tyler: "T", sophia: "S",
  alex: "A", jordan: "J", ethan: "E", luna: "L", quant: "Q",
};

function ActionBadge({ action, size = "sm" }: { action: "BUY" | "SELL" | "HOLD"; size?: "sm" | "lg" }) {
  return (
    <span className={cn(
      "font-bold font-mono tracking-widest rounded-sm",
      size === "lg" ? "text-base px-3 py-1" : "text-[10px] px-2 py-0.5",
      action === "BUY"  ? "bg-bullish/15 text-bullish border border-bullish/30" :
      action === "SELL" ? "bg-bearish/15 text-bearish border border-bearish/30" :
                          "bg-muted text-muted-foreground border border-border",
    )}>
      {action}
    </span>
  );
}

function ActionIcon({ action, className }: { action: "BUY" | "SELL" | "HOLD"; className?: string }) {
  if (action === "BUY")  return <TrendingUp  className={cn("text-bullish",  className)} />;
  if (action === "SELL") return <TrendingDown className={cn("text-bearish",  className)} />;
  return <Minus className={cn("text-muted-foreground", className)} />;
}

function ConfidenceBar({ value, action }: { value: number; action: "BUY" | "SELL" | "HOLD" }) {
  return (
    <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
      <motion.div
        className={cn(
          "h-1 rounded-full",
          action === "BUY"  ? "bg-bullish" :
          action === "SELL" ? "bg-bearish" :
                              "bg-muted-foreground/60",
        )}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

function AgentCard({ vote }: { vote: AgentVote }) {
  const [open, setOpen] = useState(false);
  const color = AGENT_COLORS[vote.agentId] ?? "hsl(220 70% 60%)";
  const initial = AGENT_INITIALS[vote.agentId] ?? vote.agentName[0];

  return (
    <motion.div
      layout
      className="border border-border rounded-sm bg-card overflow-hidden cursor-pointer hover:border-border/80 transition-colors"
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex items-center gap-3 p-3">
        <div
          className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 font-bold text-xs text-background"
          style={{ backgroundColor: color }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{vote.agentName}</span>
            {vote.opinionShifted && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-sm">
                REVISED
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground truncate">{vote.role}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ActionBadge action={vote.action} />
          <span className="text-xs font-mono tabular-nums text-muted-foreground w-9 text-right">
            {vote.confidence}%
          </span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-border pt-3 space-y-3">
              <ConfidenceBar value={vote.confidence} action={vote.action} />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">REASONING</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{vote.reasoning}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">KEY SIGNAL</p>
                <p className="text-xs font-mono text-foreground/70">{vote.keySignal}</p>
              </div>
              {vote.opinionShifted && vote.round1Action && (
                <div className="flex items-center gap-2 text-[10px] text-amber-500/80">
                  <Zap className="w-3 h-3" />
                  Changed from <ActionBadge action={vote.round1Action} /> → <ActionBadge action={vote.action} /> after peer review
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SwarmDonut({ bull, bear, hold, total }: { bull: number; bear: number; hold: number; total: number }) {
  if (total === 0) return null;
  const r = 36;
  const cx = 44;
  const cy = 44;
  const circumference = 2 * Math.PI * r;
  const bullPct  = bull / total;
  const bearPct  = bear / total;
  const holdPct  = hold / total;

  const bullLen = bullPct * circumference;
  const bearLen = bearPct * circumference;
  const holdLen = holdPct * circumference;

  const bullOffset = 0;
  const bearOffset = circumference - bullLen;
  const holdOffset = circumference - bullLen - bearLen;

  return (
    <svg viewBox="0 0 88 88" className="w-20 h-20">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(0 0% 12%)" strokeWidth="10" />
      {bullLen > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="hsl(142 71% 45%)" strokeWidth="10"
          strokeDasharray={`${bullLen} ${circumference - bullLen}`}
          strokeDashoffset={bullOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}
      {bearLen > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="hsl(0 84% 60%)" strokeWidth="10"
          strokeDasharray={`${bearLen} ${circumference - bearLen}`}
          strokeDashoffset={-bearOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}
      {holdLen > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="hsl(0 0% 40%)" strokeWidth="10"
          strokeDasharray={`${holdLen} ${circumference - holdLen}`}
          strokeDashoffset={-(bullOffset + bearLen + holdOffset)}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}
    </svg>
  );
}

function SwarmSummaryCard({ result }: { result: SwarmResult }) {
  const total = result.bullAgents + result.bearAgents + result.holdAgents;

  return (
    <Card className="relative overflow-hidden">
      <div className={cn(
        "absolute inset-y-0 left-0 w-1",
        result.action === "BUY"  ? "bg-bullish" :
        result.action === "SELL" ? "bg-bearish"  : "bg-muted-foreground",
      )} />
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-2 shrink-0">
            <SwarmDonut bull={result.bullAgents} bear={result.bearAgents} hold={result.holdAgents} total={total} />
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest">
              <span className="text-bullish">{result.bullAgents}B</span>
              <span className="text-bearish">{result.bearAgents}S</span>
              <span className="text-muted-foreground">{result.holdAgents}H</span>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <ActionIcon action={result.action} className="w-8 h-8" />
              <div>
                <ActionBadge action={result.action} size="lg" />
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                  {result.symbol} @ {formatCurrency(result.price)}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-2xl font-bold font-mono tabular-nums">{result.confidence}%</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest">CONFIDENCE</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-muted/30 rounded-sm">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">DISSENT</p>
                <p className="text-sm font-bold font-mono tabular-nums">{result.dissentScore}%</p>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded-sm">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">SWARM SCORE</p>
                <p className={cn(
                  "text-sm font-bold font-mono tabular-nums",
                  result.swarmScore > 0 ? "text-bullish" : result.swarmScore < 0 ? "text-bearish" : "",
                )}>{result.swarmScore > 0 ? "+" : ""}{result.swarmScore}</p>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded-sm">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">REVISED</p>
                <p className="text-sm font-bold font-mono tabular-nums">
                  {result.agentVotes.filter(v => v.opinionShifted).length}/{result.agentVotes.length}
                </p>
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground font-mono">
              <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {result.roundOneSummary}</span>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              <span className="inline-flex items-center gap-1"><Zap className="w-3 h-3 text-amber-500" /> {result.roundTwoSummary}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SynthesisCard({ report, durationMs }: { report: string; durationMs: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageSquare className="w-4 h-4 text-primary" />
          CHIEF STRATEGIST SYNTHESIS
          <span className="ml-auto text-[10px] font-mono text-muted-foreground tabular-nums">
            {(durationMs / 1000).toFixed(1)}s sim time
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-foreground/85">{report}</p>
      </CardContent>
    </Card>
  );
}

function HistoryRow({ item }: { item: SwarmHistoryItem }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <ActionIcon action={item.action} className="w-4 h-4 shrink-0" />
      <span className="font-mono text-sm font-bold w-12 shrink-0">{item.symbol}</span>
      <ActionBadge action={item.action} />
      <span className="text-xs text-muted-foreground font-mono tabular-nums">{item.confidence}%</span>
      <span className="text-xs text-muted-foreground ml-auto font-mono">
        {new Date(item.runAt).toLocaleDateString()} {new Date(item.runAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

export default function MirofishPage() {
  const { selectedSymbol } = useAppState();
  const [symbol, setSymbol] = useState(selectedSymbol || "AAPL");
  const [runningFor, setRunningFor] = useState<string | null>(null);

  const { data: latest, isLoading: loadingLatest } = useLatestSwarm(symbol);
  const { data: history, isLoading: loadingHistory } = useSwarmHistory(10);
  const { mutate: runSwarm, isPending: isRunning } = useRunSwarm();

  const handleRun = () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    setRunningFor(sym);
    runSwarm(sym, {
      onSettled: () => setRunningFor(null),
    });
  };

  const total = (latest?.bullAgents ?? 0) + (latest?.bearAgents ?? 0) + (latest?.holdAgents ?? 0);

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-4">
        <Users className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold leading-none">Swarm AI</h1>
          <p className="text-xs text-muted-foreground mt-0.5">10-agent investor simulation with opinion dynamics</p>
        </div>
      </div>

      {/* Controls */}
      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={symbol}
                onChange={e => setSymbol(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && !isRunning && handleRun()}
                placeholder="Symbol (e.g. AAPL)"
                className="w-full bg-muted border border-border rounded-sm px-3 py-2 text-sm font-mono uppercase placeholder:normal-case placeholder:font-sans focus:outline-none focus:border-primary/50 transition-colors"
                disabled={isRunning}
              />
            </div>
            <button
              onClick={handleRun}
              disabled={isRunning || !symbol.trim()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-sm text-sm font-semibold transition-all",
                isRunning
                  ? "bg-primary/50 text-primary-foreground/50 cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running swarm…
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Swarm
                </>
              )}
            </button>
          </div>

          {isRunning && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Simulating 10 analyst agents in parallel (2 rounds)…</span>
                <RefreshCw className="w-3 h-3 animate-spin" />
              </div>
              <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                <motion.div
                  className="h-1 bg-primary rounded-full"
                  animate={{ width: ["0%", "90%"] }}
                  transition={{ duration: 25, ease: "easeOut" }}
                />
              </div>
              <div className="grid grid-cols-5 gap-1 mt-2">
                {["Warren","Kira","Maya","Tyler","Sophia","Alex","Jordan","Ethan","Luna","Quant"].map((name, i) => (
                  <motion.div
                    key={name}
                    className="text-center"
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
                  >
                    <div
                      className="w-7 h-7 rounded-sm mx-auto mb-1 flex items-center justify-center text-[10px] font-bold text-background"
                      style={{ backgroundColor: AGENT_COLORS[name.toLowerCase()] }}
                    >
                      {name[0]}
                    </div>
                    <p className="text-[9px] text-muted-foreground truncate">{name}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left: Main results */}
        <div className="xl:col-span-2 space-y-4">
          {loadingLatest && !isRunning && (
            <div className="space-y-3">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {!loadingLatest && !isRunning && !latest && (
            <Card>
              <CardContent className="py-12 text-center">
                <Brain className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-semibold mb-1">No simulation yet</p>
                <p className="text-xs text-muted-foreground">Enter a symbol and run the swarm to see 10 analyst agents debate and vote.</p>
              </CardContent>
            </Card>
          )}

          <AnimatePresence mode="wait">
            {latest && !isRunning && (
              <motion.div
                key={latest.runAt}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <SwarmSummaryCard result={latest} />
                <SynthesisCard report={latest.synthesisReport} durationMs={latest.durationMs} />

                {/* Agent votes */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-primary" />
                      AGENT VOTES — ROUND 2 (FINAL)
                      <span className="ml-auto text-[10px] text-muted-foreground font-mono">click to expand</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {/* Sort: BUY first, then SELL, then HOLD */}
                    {[...latest.agentVotes]
                      .sort((a, b) => {
                        const order = { BUY: 0, SELL: 1, HOLD: 2 };
                        return (order[a.action] - order[b.action]) || b.confidence - a.confidence;
                      })
                      .map(vote => (
                        <AgentCard key={vote.agentId} vote={vote} />
                      ))
                    }
                  </CardContent>
                </Card>

                {/* Round comparison */}
                {latest.agentVotes.some(v => v.opinionShifted) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Zap className="w-4 h-4 text-amber-500" />
                        OPINION DYNAMICS — WHO CHANGED THEIR MIND?
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {latest.agentVotes.filter(v => v.opinionShifted).map(vote => (
                          <div key={vote.agentId} className="flex items-center gap-3 text-sm">
                            <div
                              className="w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-bold text-background shrink-0"
                              style={{ backgroundColor: AGENT_COLORS[vote.agentId] }}
                            >
                              {AGENT_INITIALS[vote.agentId]}
                            </div>
                            <span className="font-semibold">{vote.agentName}</span>
                            <ActionBadge action={vote.round1Action ?? "HOLD"} />
                            <span className="text-muted-foreground">→</span>
                            <ActionBadge action={vote.action} />
                            <span className="text-xs text-muted-foreground ml-auto hidden sm:block max-w-[200px] truncate">{vote.keySignal}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: History + agent roster */}
        <div className="space-y-4">
          {/* Agent roster */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Brain className="w-4 h-4 text-primary" />
                THE SWARM
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {[
                { id: "warren", name: "Warren", role: "Value Investor" },
                { id: "kira",   name: "Kira",   role: "Technical Analyst" },
                { id: "maya",   name: "Maya",   role: "Macro Economist" },
                { id: "tyler",  name: "Tyler",  role: "Momentum Trader" },
                { id: "sophia", name: "Sophia", role: "Risk Manager" },
                { id: "alex",   name: "Alex",   role: "Market Structure" },
                { id: "jordan", name: "Jordan", role: "Retail Sentiment" },
                { id: "ethan",  name: "Ethan",  role: "Event-Driven" },
                { id: "luna",   name: "Luna",   role: "Contrarian" },
                { id: "quant",  name: "Quant",  role: "Quantitative" },
              ].map(agent => {
                const vote = latest?.agentVotes.find(v => v.agentId === agent.id);
                return (
                  <div key={agent.id} className="flex items-center gap-2.5 py-1">
                    <div
                      className="w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-bold text-background shrink-0"
                      style={{ backgroundColor: AGENT_COLORS[agent.id] }}
                    >
                      {agent.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-none">{agent.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{agent.role}</p>
                    </div>
                    {vote ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <ActionBadge action={vote.action} />
                        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{vote.confidence}%</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40 font-mono">—</span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Vote tally if we have a result */}
          {latest && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BarChart2 className="w-4 h-4 text-primary" />
                  VOTE TALLY
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "BUY", count: latest.bullAgents,  color: "bg-bullish", textColor: "text-bullish" },
                  { label: "SELL", count: latest.bearAgents, color: "bg-bearish", textColor: "text-bearish" },
                  { label: "HOLD", count: latest.holdAgents, color: "bg-muted-foreground/50", textColor: "text-muted-foreground" },
                ].map(row => (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-[10px] font-bold uppercase tracking-widest font-mono", row.textColor)}>{row.label}</span>
                      <span className="text-xs font-mono tabular-nums text-muted-foreground">{row.count}/{total}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        className={cn("h-1.5 rounded-full", row.color)}
                        initial={{ width: 0 }}
                        animate={{ width: total > 0 ? `${(row.count / total) * 100}%` : "0%" }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}

                <div className="pt-2 border-t border-border mt-2">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span className="uppercase tracking-widest">Dissent</span>
                    <span className="font-mono tabular-nums">{latest.dissentScore}%</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span className="uppercase tracking-widest">Swarm Score</span>
                    <span className={cn("font-mono tabular-nums font-bold",
                      latest.swarmScore > 0 ? "text-bullish" : latest.swarmScore < 0 ? "text-bearish" : ""
                    )}>
                      {latest.swarmScore > 0 ? "+" : ""}{latest.swarmScore}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* History */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-primary" />
                RECENT SIMULATIONS
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : !history?.length ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                  <AlertCircle className="w-4 h-4" />
                  No simulations run yet
                </div>
              ) : (
                <div>
                  {history.map(item => <HistoryRow key={item.id} item={item} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
