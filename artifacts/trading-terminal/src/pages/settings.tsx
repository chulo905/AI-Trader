import React from "react";
import { Card, CardHeader, CardTitle, CardContent, PageTransition, Btn } from "@/components/terminal-ui";
import { Settings, Sparkles, Shield, RefreshCw, Info } from "lucide-react";
import { useAppState } from "@/hooks/use-app-state";
import { useQueryClient } from "@tanstack/react-query";

export default function SettingsPage() {
  const { selectedSymbol, setSelectedSymbol } = useAppState();
  const queryClient = useQueryClient();

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-2">
        <Settings className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      <div className="max-w-2xl flex flex-col gap-5">

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <CardTitle>AI Pilot</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Row label="Default Symbol" desc="What AI Pilot analyzes when you first open it">
              <input
                value={selectedSymbol}
                onChange={e => setSelectedSymbol(e.target.value.toUpperCase())}
                className="w-28 h-8 rounded-sm border border-border bg-muted/50 px-3 text-sm font-mono text-right focus:outline-none focus:ring-1 focus:ring-primary/50 uppercase"
              />
            </Row>
            <Row label="AI Cache Duration" desc="AI decisions are reused for 3 minutes to save time">
              <span className="text-xs bg-bullish/10 text-bullish border border-bullish/20 px-2 py-1 rounded-sm font-medium">3 min cache</span>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-warning" />
              <CardTitle>Account</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Row label="Starting Balance" desc="Your simulated paper trading account">
              <span className="font-mono font-bold text-sm">$100,000</span>
            </Row>
            <Row label="Trading Mode" desc="No real money is ever used on this platform">
              <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded-sm font-medium">Paper Only ✓</span>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-muted-foreground" />
              <CardTitle>About & Disclaimer</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">AI Trader</strong> is a paper trading simulator powered by artificial intelligence.
              All trades use virtual money — no real funds are at risk.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              AI analysis is for <strong className="text-foreground">educational purposes only</strong> and does not constitute financial advice.
              Past performance of the AI does not guarantee future results. Always consult a financial professional before investing real money.
            </p>
            <Btn
              variant="outline" size="sm"
              onClick={() => { queryClient.clear(); window.location.reload(); }}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Clear Cache & Reload
            </Btn>
          </CardContent>
        </Card>

      </div>
    </PageTransition>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}
