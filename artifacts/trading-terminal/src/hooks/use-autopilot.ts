import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface AutopilotDecision {
  symbol: string;
  price: number;
  change: number;
  action: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";
  confidence: number;
  headline: string;
  reasoning: string;
  whatHappensNext: string;
  riskNote: string;
  suggestedShares: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  aiPowered: boolean;
  generatedAt: string;
  indicators?: Record<string, number | string | boolean | null>;
}

export interface ExecutedTrade {
  id: number;
  symbol: string;
  side: string;
  shares: number;
  entryPrice: number;
}

export interface ExecuteResult {
  executed: boolean;
  action: string;
  symbol: string;
  message: string;
  trade?: ExecutedTrade;
  closedTrades?: number;
}

export function useAutopilotDecision(symbol: string, options?: { staleTime?: number; refetchInterval?: number | false }) {
  return useQuery<AutopilotDecision>({
    queryKey: [`/api/autopilot/${symbol}`],
    queryFn: () => customFetch<AutopilotDecision>(`/api/autopilot/${symbol}`),
    staleTime: options?.staleTime ?? 5 * 60 * 1000,
    refetchInterval: options?.refetchInterval,
    retry: 1,
  });
}

export function useExecuteAutopilotTrade() {
  const queryClient = useQueryClient();
  return useMutation<ExecuteResult, Error, {
    symbol: string;
    action: string;
    shares: number;
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
  }>({
    mutationFn: ({ symbol, ...data }) =>
      customFetch<ExecuteResult>(`/api/autopilot/${symbol}/execute`, {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
    },
  });
}
