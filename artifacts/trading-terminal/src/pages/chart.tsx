import React, { useState } from "react";
import { useGetMarketHistory, useGetQuote } from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { TerminalCard, PageTransition, TerminalSkeleton, ErrorPanel, PriceChange } from "@/components/terminal-ui";
import { formatPrice } from "@/lib/utils";
import { ResponsiveContainer, ComposedChart, Area, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format } from "date-fns";

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
const PERIODS = ['1D', '5D', '1M', '3M', '6M', '1Y'] as const;

export default function ChartPage() {
  const { selectedSymbol } = useAppState();
  const [timeframe, setTimeframe] = useState<any>('1d');
  const [period, setPeriod] = useState<any>('3M');
  
  const { data: quote } = useGetQuote(selectedSymbol, { query: { refetchInterval: 10000 } });
  const { data: history, isLoading, error } = useGetMarketHistory(selectedSymbol, { timeframe, period });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card/95 backdrop-blur-md border border-border p-3 rounded-lg shadow-xl text-sm font-mono z-50">
          <div className="text-muted-foreground mb-2">{format(new Date(label), "MMM dd, yyyy HH:mm")}</div>
          {payload.map((p: any) => (
            <div key={p.dataKey} style={{ color: p.color }} className="flex justify-between gap-4">
              <span className="uppercase">{p.name}:</span>
              <span className="font-bold">{p.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <PageTransition>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            {selectedSymbol}
            {quote && <span className="font-mono text-xl">{formatPrice(quote.price)}</span>}
            {quote && <PriceChange value={quote.changePercent} className="text-lg" />}
          </h1>
          <p className="text-sm text-muted-foreground">{quote?.name}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 text-xs font-mono rounded-md transition-all ${timeframe === tf ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-mono rounded-md transition-all ${period === p ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <TerminalCard className="flex-1 min-h-[600px] p-0 relative">
        {error ? <div className="p-6"><ErrorPanel error={error} /></div> : isLoading ? <TerminalSkeleton className="w-full h-full absolute inset-0" /> : (
          <div className="absolute inset-0 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={history || []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  tickFormatter={(t) => format(new Date(t), "MMM dd")} 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  tickMargin={10}
                />
                <YAxis 
                  yAxisId="price" 
                  domain={['auto', 'auto']} 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  tickFormatter={(v) => `$${v.toFixed(2)}`}
                />
                <YAxis yAxisId="volume" orientation="right" hide />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  yAxisId="price" 
                  type="monotone" 
                  dataKey="close" 
                  name="Price"
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorPrice)" 
                  isAnimationActive={false}
                />
                <Bar 
                  yAxisId="volume" 
                  dataKey="volume" 
                  name="Volume"
                  fill="hsl(var(--muted))" 
                  opacity={0.5}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </TerminalCard>
    </PageTransition>
  );
}
