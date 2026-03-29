import React, { useState } from "react";
import { useGetAlerts, useCreateAlert, useDeleteAlert } from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { Card, CardHeader, CardTitle, CardContent, PageTransition, Skeleton, ErrorPanel, Btn } from "@/components/terminal-ui";
import { Bell, Trash2, Plus, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";

export default function AlertsPage() {
  const { selectedSymbol } = useAppState();
  const queryClient = useQueryClient();
  const { data: alerts, isLoading, error } = useGetAlerts({ query: { retry: false } });
  const [symbol, setSymbol] = useState(selectedSymbol);
  const [type, setType] = useState<"price_above" | "price_below">("price_above");
  const [price, setPrice] = useState("");
  const [created, setCreated] = useState(false);

  const createMutation = useCreateAlert({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
        setPrice("");
        setCreated(true);
        setTimeout(() => setCreated(false), 3000);
      }
    }
  });

  const deleteMutation = useDeleteAlert({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/alerts"] })
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !price) return;
    createMutation.mutate({
      data: { symbol: symbol.toUpperCase(), type, price: parseFloat(price), message: `${symbol.toUpperCase()} ${type === "price_above" ? "rose above" : "fell below"} $${price}` }
    });
  };

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-2">
        <Bell className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">Price Alerts</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-4">Get notified when a stock hits a price target.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Create Alert */}
        <Card>
          <CardHeader><CardTitle>New Alert</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Stock Symbol</label>
                <input
                  value={symbol}
                  onChange={e => setSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. AAPL"
                  className="w-full h-9 rounded-xl border border-border bg-muted/40 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Alert When Price</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setType("price_above")} className={cn("flex-1 py-2 rounded-xl text-sm font-medium border transition-all", type === "price_above" ? "bg-bullish/10 text-bullish border-bullish/30" : "border-border text-muted-foreground hover:bg-muted")}>Goes Above</button>
                  <button type="button" onClick={() => setType("price_below")} className={cn("flex-1 py-2 rounded-xl text-sm font-medium border transition-all", type === "price_below" ? "bg-bearish/10 text-bearish border-bearish/30" : "border-border text-muted-foreground hover:bg-muted")}>Falls Below</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Target Price ($)</label>
                <input
                  type="number" step="0.01" value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="e.g. 185.00"
                  className="w-full h-9 rounded-xl border border-border bg-muted/40 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>
              {created && (
                <div className="flex items-center gap-2 text-bullish text-sm bg-bullish/10 border border-bullish/20 px-3 py-2 rounded-xl">
                  <CheckCircle2 className="w-4 h-4" /> Alert created!
                </div>
              )}
              <Btn type="submit" variant="primary" disabled={createMutation.isPending}>
                <Plus className="w-4 h-4" /> Create Alert
              </Btn>
            </form>
          </CardContent>
        </Card>

        {/* Alerts List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Your Alerts</CardTitle>
              <span className="text-xs text-muted-foreground">{alerts?.length ?? 0} active</span>
            </CardHeader>
            <CardContent>
              {error ? <ErrorPanel error={error} /> : isLoading ? <Skeleton className="h-48" /> : !alerts?.length ? (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No alerts yet. Create one to get notified.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {alerts.map(alert => (
                    <div key={alert.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-2 h-2 rounded-full", alert.triggered ? "bg-muted-foreground" : "bg-bullish animate-pulse")} />
                        <div>
                          <p className="font-mono font-bold text-sm">{alert.symbol}</p>
                          <p className="text-xs text-muted-foreground">
                            {alert.type === "price_above" ? "Notify when above" : "Notify when below"} <span className="font-mono text-foreground">${alert.price}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {alert.triggered && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-lg">Triggered</span>}
                        <button
                          onClick={() => deleteMutation.mutate({ id: alert.id })}
                          className="text-muted-foreground hover:text-bearish transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
