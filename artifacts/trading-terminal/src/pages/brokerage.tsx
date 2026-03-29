import React from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent, PageTransition } from "@/components/terminal-ui";
import { Cable, CheckCircle2, XCircle, Clock, AlertTriangle, Key } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface BrokerageStatus {
  provider: string;
  connected: boolean;
  paperTrading: boolean;
  alpacaConfigured: boolean;
  availableProviders: {
    id: string;
    name: string;
    description: string;
    configured: boolean;
    requiresKeys: string[];
  }[];
}

interface MarketStatus {
  isOpen: boolean;
  currentTimeET: string;
  marketHours: string;
  preMarket: boolean;
  afterHours: boolean;
  isWeekend: boolean;
}

export default function BrokeragePage() {
  const { data: status } = useQuery<BrokerageStatus>({
    queryKey: ["/api/brokerage/status"],
    queryFn: () => customFetch(`${BASE}/api/brokerage/status`).then(r => r.json()),
    refetchInterval: 60000,
    placeholderData: {
      provider: "paper", connected: true, paperTrading: true, alpacaConfigured: false,
      availableProviders: [
        { id: "paper", name: "Built-in Paper Trading", description: "Simulated trading with $100,000 virtual money.", configured: true, requiresKeys: [] },
        { id: "alpaca", name: "Alpaca (Paper)", description: "Alpaca paper trading account.", configured: false, requiresKeys: ["ALPACA_API_KEY", "ALPACA_API_SECRET"] },
        { id: "interactive-brokers", name: "Interactive Brokers", description: "Coming soon.", configured: false, requiresKeys: ["IB_CLIENT_ID"] },
      ],
    },
  });

  const { data: market } = useQuery<MarketStatus>({
    queryKey: ["/api/brokerage/market-open"],
    queryFn: () => customFetch(`${BASE}/api/brokerage/market-open`).then(r => r.json()),
    refetchInterval: 60000,
    placeholderData: { isOpen: false, currentTimeET: "--:--", marketHours: "9:30 AM – 4:00 PM ET, Mon–Fri", preMarket: false, afterHours: false, isWeekend: false },
  });

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-2">
        <Cable className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">Brokerage Integration</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-4 mb-6">Connect a real brokerage when you're ready to trade with actual money. Currently running in safe paper trading mode.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Active Connection */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Connection</CardTitle>
                <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold border", status?.connected ? "bg-bullish/10 text-bullish border-bullish/20" : "bg-bearish/10 text-bearish border-bearish/20")}>
                  {status?.connected ? "● Connected" : "○ Disconnected"}
                </span>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-4 rounded-sm bg-primary/5 border border-primary/20 mb-4">
                  <div className="w-12 h-12 rounded-sm bg-primary/10 flex items-center justify-center">
                    <Cable className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{status?.provider === "paper" ? "Built-in Paper Trading" : status?.provider}</p>
                    <p className="text-sm text-muted-foreground">{status?.paperTrading ? "Simulated trading — no real money at risk" : "Live trading active"}</p>
                  </div>
                  <div className="ml-auto">
                    {status?.paperTrading ? (
                      <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-sm font-semibold">Paper Only</span>
                    ) : (
                      <span className="text-xs bg-bearish/10 text-bearish border border-bearish/20 px-3 py-1.5 rounded-sm font-semibold">LIVE MONEY</span>
                    )}
                  </div>
                </div>

                {/* Market Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={cn("p-4 rounded-sm border", market?.isOpen ? "bg-bullish/5 border-bullish/20" : "bg-muted/30 border-border/40")}>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Market Status</span>
                    </div>
                    <p className={cn("font-bold text-lg", market?.isOpen ? "text-bullish" : "text-muted-foreground")}>
                      {market?.isOpen ? "OPEN" : market?.preMarket ? "Pre-Market" : market?.afterHours ? "After Hours" : market?.isWeekend ? "Closed (Weekend)" : "CLOSED"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{market?.currentTimeET} ET</p>
                  </div>
                  <div className="p-4 rounded-sm border border-border/40 bg-muted/20">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Market Hours</span>
                    </div>
                    <p className="font-semibold text-sm">{market?.marketHours}</p>
                    <p className="text-xs text-muted-foreground mt-1">US Eastern Time</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Available Providers */}
            <Card>
              <CardHeader><CardTitle>Available Brokerages</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {status?.availableProviders.map(provider => (
                    <div key={provider.id} className={cn("p-4 rounded-sm border", provider.configured ? "border-bullish/20 bg-bullish/5" : "border-border/50 bg-muted/20")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {provider.configured ? <CheckCircle2 className="w-4 h-4 text-bullish mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
                          <div>
                            <p className="font-semibold text-sm">{provider.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{provider.description}</p>
                            {provider.requiresKeys.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-2">
                                <Key className="w-3 h-3 text-muted-foreground/60" />
                                <p className="text-[10px] text-muted-foreground/60 font-mono">{provider.requiresKeys.join(", ")}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold border shrink-0", provider.configured ? "bg-bullish/10 text-bullish border-bullish/20" : "bg-muted text-muted-foreground border-border")}>
                          {provider.configured ? "Active" : provider.id === "interactive-brokers" ? "Coming Soon" : "Not configured"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Setup Guide */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader><CardTitle>Connect Alpaca</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 text-sm">
                  {[
                    { step: "1", text: "Create a free account at alpaca.markets" },
                    { step: "2", text: "Go to Paper Trading → API Keys" },
                    { step: "3", text: "Generate your API Key & Secret" },
                    { step: "4", text: "Add ALPACA_API_KEY to environment secrets" },
                    { step: "5", text: "Add ALPACA_API_SECRET to environment secrets" },
                    { step: "6", text: "Restart the server — Alpaca activates automatically" },
                  ].map(item => (
                    <div key={item.step} className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{item.step}</div>
                      <p className="text-muted-foreground leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Safety Warning</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-start gap-3 p-3 rounded-sm bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300 leading-relaxed">
                    Live brokerage integration means the AI will execute trades with <strong>real money</strong>. Always start with paper trading, backtest thoroughly, and set strict risk limits before connecting a live account.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>WebSocket Status</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 p-3 rounded-sm bg-primary/5 border border-primary/20">
                  <div className="w-2 h-2 rounded-full bg-bullish animate-pulse" />
                  <div>
                    <p className="text-sm font-semibold">Real-time feed active</p>
                    <p className="text-xs text-muted-foreground">Connect via ws://…/ws for live price streaming</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
    </PageTransition>
  );
}
