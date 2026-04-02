import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface AgentVote {
  agentId: string;
  agentName: string;
  role: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  reasoning: string;
  keySignal: string;
  round1Action?: "BUY" | "SELL" | "HOLD";
  opinionShifted: boolean;
}

export interface SwarmResult {
  id?: number;
  symbol: string;
  price: number;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  dissentScore: number;
  swarmScore: number;
  bullAgents: number;
  bearAgents: number;
  holdAgents: number;
  agentVotes: AgentVote[];
  synthesisReport: string;
  roundOneSummary: string;
  roundTwoSummary: string;
  durationMs: number;
  runAt: string;
  source?: "cache" | "db";
}

export interface SwarmHistoryItem {
  id: number;
  symbol: string;
  price: number;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  dissentScore: number;
  swarmScore: number;
  bullAgents: number;
  bearAgents: number;
  holdAgents: number;
  synthesisReport: string;
  durationMs: number;
  runAt: string;
}

export function useLatestSwarm(symbol: string) {
  return useQuery({
    queryKey: ["mirofish", symbol, "latest"],
    queryFn: () => customFetch<SwarmResult>(`/api/mirofish/${symbol}/latest`),
    enabled: !!symbol,
    retry: false,
    staleTime: 14 * 60 * 1000,
  });
}

export function useSwarmHistory(limit = 20) {
  return useQuery({
    queryKey: ["mirofish", "history", limit],
    queryFn: () => customFetch<SwarmHistoryItem[]>(`/api/mirofish/history?limit=${limit}`),
    staleTime: 60_000,
  });
}

export function useRunSwarm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) =>
      customFetch<SwarmResult>(`/api/mirofish/${symbol}/run`, { method: "POST" }),
    onSuccess: (data, symbol) => {
      qc.setQueryData(["mirofish", symbol, "latest"], data);
      qc.invalidateQueries({ queryKey: ["mirofish", "history"] });
    },
  });
}
