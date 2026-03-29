import React, { useState } from "react";
import { useGetAlerts, useCreateAlert, useDeleteAlert } from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { TerminalCard, PageTransition, TerminalSkeleton, ErrorPanel, TerminalTable, TerminalButton, TerminalInput, TerminalLabel } from "@/components/terminal-ui";
import { Bell, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function AlertsPage() {
  const { selectedSymbol } = useAppState();
  const queryClient = useQueryClient();
  const { data: alerts, isLoading, error } = useGetAlerts();

  const [symbol, setSymbol] = useState(selectedSymbol);
  const [type, setType] = useState<any>("price_above");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");

  const createMutation = useCreateAlert({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
        setValue("");
        setMessage("");
      }
    }
  });

  const deleteMutation = useDeleteAlert({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/alerts'] })
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      data: {
        symbol: symbol.toUpperCase(),
        type,
        value: value ? Number(value) : null,
        message: message || null
      }
    });
  };

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-6">
        <Bell className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Market Alerts</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <TerminalCard title="Create Alert">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <TerminalLabel>Symbol</TerminalLabel>
                <TerminalInput value={symbol} onChange={e => setSymbol(e.target.value)} required placeholder="AAPL" className="uppercase" />
              </div>
              <div>
                <TerminalLabel>Condition</TerminalLabel>
                <select 
                  value={type} 
                  onChange={e => setType(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option value="price_above">Price Above</option>
                  <option value="price_below">Price Below</option>
                  <option value="percent_change">Daily Change %</option>
                  <option value="volume_spike">Volume Spike</option>
                </select>
              </div>
              <div>
                <TerminalLabel>Value Target</TerminalLabel>
                <TerminalInput type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)} required placeholder="e.g. 150.00" />
              </div>
              <div>
                <TerminalLabel>Note (Optional)</TerminalLabel>
                <TerminalInput value={message} onChange={e => setMessage(e.target.value)} placeholder="e.g. Breakout level" />
              </div>
              <TerminalButton type="submit" disabled={createMutation.isPending} className="mt-2">
                {createMutation.isPending ? "Creating..." : "Set Alert"}
              </TerminalButton>
            </form>
          </TerminalCard>
        </div>

        <div className="lg:col-span-2">
          <TerminalCard title="Active Alerts">
            {error ? <ErrorPanel error={error} /> : isLoading ? <TerminalSkeleton className="h-[400px]" /> : (
              <TerminalTable headers={["Symbol", "Condition", "Value", "Status", "Action"]}>
                {alerts?.map(alert => (
                  <tr key={alert.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-bold font-mono text-base">{alert.symbol}</td>
                    <td className="px-4 py-3 text-muted-foreground uppercase text-xs">{alert.type.replace('_', ' ')}</td>
                    <td className="px-4 py-3 font-mono">{alert.value !== null ? alert.value : '—'}</td>
                    <td className="px-4 py-3">
                      {alert.isTriggered ? (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">TRIGGERED</span>
                      ) : (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">ACTIVE</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <TerminalButton variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteMutation.mutate({ id: alert.id })}>
                        <Trash2 className="w-4 h-4" />
                      </TerminalButton>
                    </td>
                  </tr>
                ))}
                {!alerts?.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No alerts set.</td>
                  </tr>
                )}
              </TerminalTable>
            )}
          </TerminalCard>
        </div>
      </div>
    </PageTransition>
  );
}
