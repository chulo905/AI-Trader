import React from "react";
import { Link } from "wouter";
import { useGetMarketMovers } from "@workspace/api-client-react";
import { Sparkles } from "lucide-react";
import { SymbolSearch } from "./SymbolSearch";
import { cn } from "@/lib/utils";
import { useWebSocketContext } from "@/context/websocket-context";
import type { WsStatus } from "@/hooks/use-websocket";

interface TopNavProps {
  hasMockData?: boolean;
}

function WsStatusDot({ status }: { status: WsStatus }) {
  return (
    <div className="flex items-center gap-1.5" title={`WebSocket: ${status}`}>
      <span
        className={cn(
          "w-2 h-2 rounded-full shrink-0 transition-colors",
          status === "connected" && "bg-bullish shadow-[0_0_4px_1px_rgba(34,197,94,0.5)]",
          status === "reconnecting" && "bg-amber-400 animate-pulse shadow-[0_0_4px_1px_rgba(251,191,36,0.5)]",
          (status === "disconnected" || status === "connecting") && "bg-bearish"
        )}
      />
    </div>
  );
}

export function TopNav({ hasMockData }: TopNavProps) {
  const { data: movers } = useGetMarketMovers({ query: { retry: false, staleTime: 60000 } });
  const { status, isMarketOpen } = useWebSocketContext();

  const topGainer = movers?.gainers?.find(x => x.changePercent > 0);
  const topLoser = movers?.losers?.find(x => x.changePercent < 0);

  return (
    <header className="h-12 flex items-center justify-between px-4 lg:px-5 border-b border-border bg-card shrink-0">
      <SymbolSearch />

      <div className="flex items-center gap-3">
        {hasMockData && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-bold tracking-widest uppercase border border-amber-500/30 bg-amber-500/10 text-amber-400">
            ⚠ MOCK DATA
          </span>
        )}

        {!isMarketOpen && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-widest uppercase border border-muted-foreground/20 bg-muted/60 text-muted-foreground">
            MARKET CLOSED
          </span>
        )}

        {topGainer && (
          <div className="hidden md:flex items-center gap-1.5 text-xs">
            <span className="text-bullish/40">▲</span>
            <span className="font-mono font-semibold text-bullish tabular-nums">
              {topGainer.symbol} +{topGainer.changePercent.toFixed(1)}%
            </span>
          </div>
        )}
        {topLoser && (
          <div className="hidden md:flex items-center gap-1.5 text-xs">
            <span className="text-bearish/40">▼</span>
            <span className="font-mono font-semibold text-bearish tabular-nums">
              {topLoser.symbol} {topLoser.changePercent.toFixed(1)}%
            </span>
          </div>
        )}

        <div className={cn("w-px h-4 bg-border hidden md:block", !topGainer && !topLoser && "hidden")} />

        <WsStatusDot status={status} />

        <Link href="/autopilot">
          <button className="flex items-center gap-1.5 h-7 px-3 rounded-sm bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-all">
            <Sparkles className="w-3 h-3" /> AI Pilot
          </button>
        </Link>
      </div>
    </header>
  );
}
