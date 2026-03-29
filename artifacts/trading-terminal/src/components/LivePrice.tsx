import React from "react";
import { cn } from "@/lib/utils";
import { useTickerPrice } from "@/hooks/use-ticker-price";
import { formatPrice } from "@/lib/utils";

interface LivePriceProps {
  symbol: string;
  fallbackPrice?: number;
  className?: string;
}

export function LivePrice({ symbol, fallbackPrice, className }: LivePriceProps) {
  const { price, flashDirection } = useTickerPrice(symbol);

  const displayPrice = price ?? fallbackPrice ?? null;

  return (
    <span
      className={cn(
        "tabular-nums font-mono transition-colors duration-300",
        flashDirection === "up" && "text-bullish",
        flashDirection === "down" && "text-bearish",
        !flashDirection && "text-foreground",
        className
      )}
    >
      {displayPrice !== null ? formatPrice(displayPrice) : "—"}
    </span>
  );
}
