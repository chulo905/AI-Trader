import { useState, useEffect } from "react";
import { useGetPositions, useCreateTrade, useCloseTrade, useGetQuote } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { resolvePositions } from "@/lib/utils";

export type TradeSide = "long" | "short";

export function usePaperTradeForm(selectedSymbol: string) {
  const queryClient = useQueryClient();

  const { data: positionsData, isLoading, error } = useGetPositions();
  const positions = resolvePositions(positionsData);
  const { data: quote } = useGetQuote(selectedSymbol);

  const [side, setSide] = useState<TradeSide>("long");
  const [shares, setShares] = useState("10");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");

  useEffect(() => {
    if (quote) {
      setEntryPrice(quote.price.toString());
    }
  }, [quote?.symbol]);

  const createMutation = useCreateTrade({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio/positions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      },
    },
  });

  const closeMutation = useCloseTrade({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio/positions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      },
    },
  });

  const submitTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSymbol || !shares || !entryPrice) return;
    createMutation.mutate({
      data: {
        symbol: selectedSymbol,
        side,
        shares: Number(shares),
        entryPrice: Number(entryPrice),
        stopLoss: stopLoss ? Number(stopLoss) : null,
        takeProfit: takeProfit ? Number(takeProfit) : null,
      },
    });
  };

  const closePosition = (id: number, currentPrice: number) => {
    closeMutation.mutate({ id, data: { exitPrice: currentPrice } });
  };

  return {
    positions,
    isLoading,
    error,
    quote,
    side,
    setSide,
    shares,
    setShares,
    entryPrice,
    setEntryPrice,
    stopLoss,
    setStopLoss,
    takeProfit,
    setTakeProfit,
    submitTrade,
    closePosition,
    isSubmitting: createMutation.isPending,
    isClosing: closeMutation.isPending,
  };
}
