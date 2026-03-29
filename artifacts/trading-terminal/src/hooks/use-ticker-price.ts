import { useEffect, useRef, useState } from "react";
import { useWebSocketContext } from "@/context/websocket-context";

export type FlashDirection = "up" | "down" | null;

export interface TickerPriceResult {
  price: number | null;
  change: number | null;
  changePercent: number | null;
  flashDirection: FlashDirection;
}

const FLASH_DURATION_MS = 800;

export function useTickerPrice(symbol: string | null | undefined): TickerPriceResult {
  const { lastMessage, send, status } = useWebSocketContext();
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number | null>(null);
  const [changePercent, setChangePercent] = useState<number | null>(null);
  const [flashDirection, setFlashDirection] = useState<FlashDirection>(null);
  const prevPriceRef = useRef<number | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sym = symbol?.toUpperCase() ?? null;

  useEffect(() => {
    if (!sym || status !== "connected") return;
    send({ type: "subscribe", symbol: sym });
    return () => {
      send({ type: "unsubscribe", symbol: sym });
    };
  }, [sym, status, send]);

  useEffect(() => {
    if (!lastMessage || !sym) return;
    if (lastMessage.type !== "tick" && lastMessage.type !== "price") return;
    if ((lastMessage.symbol as string)?.toUpperCase() !== sym) return;

    const newPrice = lastMessage.price as number;
    const newChange = (lastMessage.change as number) ?? null;
    const newChangePercent = (lastMessage.changePercent as number) ?? null;

    if (prevPriceRef.current !== null && newPrice !== prevPriceRef.current) {
      const dir: FlashDirection = newPrice > prevPriceRef.current ? "up" : "down";
      setFlashDirection(dir);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashDirection(null), FLASH_DURATION_MS);
    }

    prevPriceRef.current = newPrice;
    setPrice(newPrice);
    if (newChange !== null) setChange(newChange);
    if (newChangePercent !== null) setChangePercent(newChangePercent);
  }, [lastMessage, sym]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  return { price, change, changePercent, flashDirection };
}
