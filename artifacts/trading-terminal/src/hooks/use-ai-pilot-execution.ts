import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAutopilotDecision, useExecuteAutopilotTrade } from "@/hooks/use-autopilot";

type Phase = "idle" | "executing" | "done" | "error";

export interface ExecutionResult {
  message: string;
  success: boolean;
}

export function useAiPilotExecution(selectedSymbol: string) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const decisionQuery = useAutopilotDecision(selectedSymbol, { staleTime: 3 * 60 * 1000 });
  const executeMutation = useExecuteAutopilotTrade();

  const decision = decisionQuery.data;
  const aiPowered = decision?.aiPowered === true;

  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (decision && !aiPowered) {
      pollingRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/autopilot/${selectedSymbol}`] });
      }, 12_000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [decision, aiPowered, selectedSymbol, queryClient]);

  useEffect(() => {
    setPhase("idle");
    setResult(null);
  }, [selectedSymbol]);

  const execute = async () => {
    if (!decision) return;
    setPhase("executing");
    setResult(null);
    try {
      const res = await executeMutation.mutateAsync({
        symbol: selectedSymbol,
        action: decision.action,
        shares: decision.suggestedShares,
        entryPrice: decision.price,
        stopLoss: decision.stopLoss,
        takeProfit: decision.takeProfit,
      });
      setPhase("done");
      setResult({ message: res.message, success: true });
      queryClient.invalidateQueries({ queryKey: [`/api/autopilot/${selectedSymbol}`] });
    } catch (e: unknown) {
      setPhase("error");
      const msg = e instanceof Error ? e.message : "Trade execution failed.";
      setResult({ message: msg, success: false });
    }
  };

  return {
    decision,
    isLoading: decisionQuery.isLoading,
    error: decisionQuery.error,
    isFetching: decisionQuery.isFetching,
    refetch: decisionQuery.refetch,
    aiPowered,
    phase,
    result,
    execute,
    isExecuting: phase === "executing",
    isDone: phase === "done",
  };
}
