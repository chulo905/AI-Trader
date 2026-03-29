import { useState, useEffect, useCallback, useMemo } from "react";
import { useGetPositions, useCreateTrade, useCloseTrade, useGetQuote, useGetSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { resolvePositions } from "@/lib/utils";

export type TradeSide = "long" | "short";

export interface RiskRewardMetrics {
  dollarRisk: number | null;
  riskRewardRatio: number | null;
  expectedGain: number | null;
  suggestedShares: number | null;
}

async function fetchAtr(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/market/${symbol}/atr`);
    if (!res.ok) return null;
    const data = await res.json() as { atr14?: number };
    return data.atr14 ?? null;
  } catch {
    return null;
  }
}

async function closePartial(id: number, percent: number, exitPrice?: number): Promise<void> {
  const body: { percent: number; exitPrice?: number } = { percent };
  if (exitPrice != null) body.exitPrice = exitPrice;
  const res = await fetch(`/api/trades/${id}/close-partial`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Failed to partially close trade");
  }
}

function getQueryParams(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  params.forEach((v, k) => { result[k] = v; });
  return result;
}

export function usePaperTradeForm(selectedSymbol: string) {
  const queryClient = useQueryClient();

  const { data: positionsData, isLoading, error } = useGetPositions();
  const positions = resolvePositions(positionsData);
  const { data: quote } = useGetQuote(selectedSymbol);
  const { data: settings } = useGetSettings();

  const [side, setSide] = useState<TradeSide>("long");
  const [shares, setShares] = useState("10");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [atr, setAtr] = useState<number | null>(null);
  const [isLoadingAtr, setIsLoadingAtr] = useState(false);
  const [confirmClose, setConfirmClose] = useState<{ positionId: number; price: number; pnl: number; shares: number; symbol: string } | null>(null);
  const [isPartialClosing, setIsPartialClosing] = useState(false);

  useEffect(() => {
    if (quote) {
      setEntryPrice(quote.price.toString());
    }
  }, [quote?.symbol]);

  useEffect(() => {
    if (!selectedSymbol) return;
    setIsLoadingAtr(true);
    fetchAtr(selectedSymbol).then(v => {
      setAtr(v);
      setIsLoadingAtr(false);
    });
  }, [selectedSymbol]);

  useEffect(() => {
    const params = getQueryParams();
    if (params["symbol"] && params["entry"]) {
      if (params["side"] === "long" || params["side"] === "short") {
        setSide(params["side"] as TradeSide);
      }
      if (params["entry"]) setEntryPrice(params["entry"]);
      if (params["stop"]) setStopLoss(params["stop"]);
      if (params["target"]) setTakeProfit(params["target"]);
      if (params["shares"]) setShares(params["shares"]);
    }
  }, []);

  const suggestStop = useCallback(() => {
    if (!atr || !entryPrice) return;
    const entry = Number(entryPrice);
    const suggestedStop = side === "long"
      ? Math.round((entry - atr * 1.5) * 100) / 100
      : Math.round((entry + atr * 1.5) * 100) / 100;
    setStopLoss(suggestedStop.toString());
  }, [atr, entryPrice, side]);

  const riskRewardMetrics = useMemo((): RiskRewardMetrics => {
    const entry = Number(entryPrice);
    const stop = Number(stopLoss);
    const target = Number(takeProfit);
    const qty = Number(shares);

    if (!entry || !qty) return { dollarRisk: null, riskRewardRatio: null, expectedGain: null, suggestedShares: null };

    const dollarRisk = stop && entry && qty ? Math.abs(entry - stop) * qty : null;
    const riskPerShare = stop && entry ? Math.abs(entry - stop) : null;
    const gainPerShare = target && entry ? Math.abs(target - entry) : null;
    const riskRewardRatio = riskPerShare && gainPerShare && riskPerShare > 0 ? gainPerShare / riskPerShare : null;
    const expectedGain = gainPerShare && qty ? gainPerShare * qty : null;

    const accountSize = settings?.accountSize ?? 100000;
    const maxRiskPct = settings?.maxRiskPerTrade ?? 2;
    const maxRiskDollars = accountSize * (maxRiskPct / 100);
    const suggestedShares = riskPerShare && riskPerShare > 0
      ? Math.floor(maxRiskDollars / riskPerShare)
      : null;

    return { dollarRisk, riskRewardRatio, expectedGain, suggestedShares };
  }, [entryPrice, stopLoss, takeProfit, shares, settings]);

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

  const requestClosePosition = (id: number, currentPrice: number, posShares: number, posSymbol: string, posEntryPrice: number, posSide: string) => {
    const pnl = posSide === "long"
      ? (currentPrice - posEntryPrice) * posShares
      : (posEntryPrice - currentPrice) * posShares;
    setConfirmClose({ positionId: id, price: currentPrice, pnl, shares: posShares, symbol: posSymbol });
  };

  const confirmClosePosition = () => {
    if (!confirmClose) return;
    closeMutation.mutate({ id: confirmClose.positionId, data: { exitPrice: confirmClose.price } });
    setConfirmClose(null);
  };

  const cancelClose = () => setConfirmClose(null);

  const closePartialPosition = async (id: number, percent: number, currentPrice: number) => {
    setIsPartialClosing(true);
    try {
      await closePartial(id, percent, currentPrice);
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
    } catch (err) {
      console.error("Partial close failed:", err);
    } finally {
      setIsPartialClosing(false);
    }
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
    requestClosePosition,
    confirmClosePosition,
    cancelClose,
    closePartialPosition,
    confirmClose,
    isSubmitting: createMutation.isPending,
    isClosing: closeMutation.isPending,
    isPartialClosing,
    atr,
    isLoadingAtr,
    suggestStop,
    riskRewardMetrics,
    settings,
  };
}
