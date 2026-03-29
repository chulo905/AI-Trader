import React, { useState, useEffect } from "react";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { TerminalCard, PageTransition, TerminalSkeleton, ErrorPanel, TerminalButton, TerminalInput, TerminalLabel } from "@/components/terminal-ui";
import { Settings, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading, error } = useGetSettings();
  const updateMutation = useUpdateSettings({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/settings'] })
    }
  });

  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    if (type === 'number') finalValue = Number(value);
    if (type === 'checkbox') finalValue = (e.target as HTMLInputElement).checked;
    
    setFormData((prev: any) => ({ ...prev, [name]: finalValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ data: formData });
  };

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
      </div>

      {error ? <ErrorPanel error={error} /> : isLoading ? <TerminalSkeleton className="h-[500px]" /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
          
          <TerminalCard title="Risk Controls & Account">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex items-center gap-3 p-3 bg-bearish/10 border border-bearish/20 rounded-lg text-bearish mb-2">
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                <p className="text-xs">Risk controls apply to Paper Trading module. Modifying account size resets paper performance.</p>
              </div>

              <div>
                <TerminalLabel>Paper Account Size ($)</TerminalLabel>
                <TerminalInput type="number" name="accountSize" value={formData.accountSize || ""} onChange={handleChange} required />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <TerminalLabel>Max Risk Per Trade (%)</TerminalLabel>
                  <TerminalInput type="number" step="0.1" name="maxRiskPerTrade" value={formData.maxRiskPerTrade || ""} onChange={handleChange} />
                </div>
                <div>
                  <TerminalLabel>Max Daily Loss ($)</TerminalLabel>
                  <TerminalInput type="number" name="maxDailyLoss" value={formData.maxDailyLoss || ""} onChange={handleChange} />
                </div>
              </div>

              <div>
                <TerminalLabel>Strategy Focus</TerminalLabel>
                <select 
                  name="strategyFocus" 
                  value={formData.strategyFocus || ""} 
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="momentum">Momentum</option>
                  <option value="breakout">Breakout</option>
                  <option value="mean_reversion">Mean Reversion</option>
                  <option value="swing">Swing Trading</option>
                </select>
              </div>

              <div>
                <TerminalLabel>Risk Tolerance</TerminalLabel>
                <select 
                  name="riskTolerance" 
                  value={formData.riskTolerance || ""} 
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="conservative">Conservative</option>
                  <option value="moderate">Moderate</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </div>

              <div className="flex items-center gap-3 mt-2">
                <input 
                  type="checkbox" 
                  id="alertsEnabled" 
                  name="alertsEnabled" 
                  checked={formData.alertsEnabled || false} 
                  onChange={handleChange}
                  className="w-4 h-4 accent-primary" 
                />
                <label htmlFor="alertsEnabled" className="text-sm">Enable System Alerts</label>
              </div>

              <TerminalButton type="submit" disabled={updateMutation.isPending} className="mt-4">
                {updateMutation.isPending ? "Saving..." : "Save Configuration"}
              </TerminalButton>
            </form>
          </TerminalCard>
        </div>
      )}
    </PageTransition>
  );
}
