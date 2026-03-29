import React, { useState } from "react";
import { useRiskMetrics, useUpdateRiskSettings } from "@/hooks/use-risk";
import type { RiskSettingsInput } from "@/hooks/use-risk";
import { Card, CardHeader, CardTitle, CardContent, PageTransition, Btn } from "@/components/terminal-ui";
import { Shield, AlertTriangle, CheckCircle2, XCircle, Save } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

function GaugeMeter({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("text-xs font-bold", color)}>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", value > 90 ? "bg-bearish" : value > 60 ? "bg-amber-500" : "bg-bullish")} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

export default function RiskPage() {
  const { data: metrics } = useRiskMetrics();
  const saveMutation = useUpdateRiskSettings();
  const [form, setForm] = useState<Partial<RiskSettingsInput>>({});
  const [saved, setSaved] = useState(false);

  const s = metrics?.settings;
  const health = metrics?.health;

  const statusColor = health?.overallStatus === "healthy" ? "text-bullish" : health?.overallStatus === "warning" ? "text-amber-400" : "text-bearish";
  const StatusIcon = health?.overallStatus === "healthy" ? CheckCircle2 : health?.overallStatus === "warning" ? AlertTriangle : XCircle;

  const handleSave = () => {
    saveMutation.mutate({ data: form }, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      },
    });
  };

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-2">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">Risk Management</h1>
        {health && (
          <span className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border", health.overallStatus === "healthy" ? "bg-bullish/10 text-bullish border-bullish/20" : health.overallStatus === "warning" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-bearish/10 text-bearish border-bearish/20")}>
            <StatusIcon className="w-3 h-3" /> {health.overallStatus.charAt(0).toUpperCase() + health.overallStatus.slice(1)}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground -mt-4 mb-6">Non-negotiable guardrails that protect your paper portfolio. The AI cannot override these rules.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Portfolio Health */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Portfolio Equity", value: formatCurrency(metrics?.equity ?? 100000), sub: "Paper balance" },
                { label: "Open Positions", value: metrics?.openPositions ?? 0, sub: `of ${s?.maxOpenPositions ?? 5} max` },
                { label: "Today's Loss", value: formatCurrency(metrics?.todayRealizedLoss ?? 0), sub: `of $${s?.maxDailyLoss ?? 500} limit` },
                { label: "Max Drawdown", value: `${((metrics?.maxDrawdown ?? 0) * 100).toFixed(1)}%`, sub: `of ${((s?.maxDrawdownPct ?? 0.15) * 100).toFixed(0)}% limit` },
              ].map(stat => (
                <Card key={stat.label} className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</p>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader><CardTitle>Risk Utilization</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <GaugeMeter value={health?.dailyLossUsed ?? 0} label="Daily Loss Limit" color={statusColor} />
                  <GaugeMeter value={health?.drawdownUsed ?? 0} label="Max Drawdown Limit" color={statusColor} />
                  <GaugeMeter value={health?.positionsUsed ?? 0} label="Open Position Limit" color={statusColor} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Active Risk Rules</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { label: "Stop-Loss Enforcement", active: s?.stopLossEnforcement, desc: "Auto-close positions hitting stop price" },
                    { label: "Trading Enabled", active: s?.tradingEnabled, desc: "Master switch — turn off to halt all trades" },
                    { label: "Max Daily Loss", active: true, desc: `Block trades after $${s?.maxDailyLoss ?? 500} lost today` },
                    { label: "Position Size Cap", active: true, desc: `Max ${((s?.maxPositionSize ?? 0.1) * 100).toFixed(0)}% portfolio in one trade` },
                    { label: "Drawdown Circuit Breaker", active: true, desc: `Stop trading at ${((s?.maxDrawdownPct ?? 0.15) * 100).toFixed(0)}% portfolio loss` },
                    { label: "Concurrent Position Limit", active: true, desc: `Max ${s?.maxOpenPositions ?? 5} open positions at once` },
                  ].map(rule => (
                    <div key={rule.label} className="flex items-start gap-3 p-3 rounded-sm border border-border/40 bg-muted/20">
                      {rule.active ? <CheckCircle2 className="w-4 h-4 text-bullish shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                      <div>
                        <p className="text-sm font-medium">{rule.label}</p>
                        <p className="text-xs text-muted-foreground">{rule.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Settings Panel */}
          <Card>
            <CardHeader><CardTitle>Adjust Limits</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {[
                  { key: "maxDailyLoss" as const, label: "Max Daily Loss ($)", def: s?.maxDailyLoss ?? 500, min: 100, max: 5000, step: 100 },
                  { key: "maxPositionSize" as const, label: "Max Position Size (%)", def: (s?.maxPositionSize ?? 0.1) * 100, min: 1, max: 30, step: 1 },
                  { key: "maxOpenPositions" as const, label: "Max Open Positions", def: s?.maxOpenPositions ?? 5, min: 1, max: 20, step: 1 },
                  { key: "maxDrawdownPct" as const, label: "Max Drawdown (%)", def: (s?.maxDrawdownPct ?? 0.15) * 100, min: 5, max: 50, step: 5 },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-xs text-muted-foreground mb-1.5 block">{field.label}</label>
                    <input
                      type="number"
                      defaultValue={field.def}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        if (field.key === "maxPositionSize") setForm(f => ({ ...f, maxPositionSize: val / 100 }));
                        else if (field.key === "maxDrawdownPct") setForm(f => ({ ...f, maxDrawdownPct: val / 100 }));
                        else setForm(f => ({ ...f, [field.key]: val }));
                      }}
                      className="w-full h-9 rounded-sm border border-border bg-muted/40 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                ))}

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Stop-Loss Enforcement</label>
                  <div className="flex gap-2">
                    {[true, false].map(val => (
                      <button key={String(val)} onClick={() => setForm(f => ({ ...f, stopLossEnforcement: val }))}
                        className={cn("flex-1 py-2 rounded-sm text-sm font-medium border transition-all", (form.stopLossEnforcement ?? s?.stopLossEnforcement) === val ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground hover:bg-muted")}>
                        {val ? "Enabled" : "Disabled"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Master Trading Switch</label>
                  <div className="flex gap-2">
                    {[true, false].map(val => (
                      <button key={String(val)} onClick={() => setForm(f => ({ ...f, tradingEnabled: val }))}
                        className={cn("flex-1 py-2 rounded-sm text-sm font-medium border transition-all", (form.tradingEnabled ?? s?.tradingEnabled) === val ? val ? "bg-bullish/10 text-bullish border-bullish/30" : "bg-bearish/10 text-bearish border-bearish/30" : "border-border text-muted-foreground hover:bg-muted")}>
                        {val ? "Trading ON" : "Trading OFF"}
                      </button>
                    ))}
                  </div>
                </div>

                {saved && <div className="flex items-center gap-2 text-bullish text-sm bg-bullish/10 border border-bullish/20 px-3 py-2 rounded-sm"><CheckCircle2 className="w-4 h-4" /> Settings saved</div>}
                <Btn variant="primary" disabled={saveMutation.isPending} onClick={handleSave}>
                  <Save className="w-4 h-4" /> Save Settings
                </Btn>
              </div>
            </CardContent>
          </Card>
        </div>
    </PageTransition>
  );
}
