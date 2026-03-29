import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useWebSocket, type WsStatus, type WsMessage } from "@/hooks/use-websocket";

interface WebSocketContextValue {
  lastMessage: WsMessage | null;
  status: WsStatus;
  send: (msg: object) => void;
  isMarketOpen: boolean;
  nextMarketOpen: string | null;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  lastMessage: null,
  status: "connecting",
  send: () => {},
  isMarketOpen: true,
  nextMarketOpen: null,
});

export function useWebSocketContext(): WebSocketContextValue {
  return useContext(WebSocketContext);
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { lastMessage: rawMessage, status, send } = useWebSocket();
  const [filteredMessage, setFilteredMessage] = useState<WsMessage | null>(null);
  const [isMarketOpen, setIsMarketOpen] = useState<boolean>(true);
  const [nextMarketOpen, setNextMarketOpen] = useState<string | null>(null);
  const prevRawRef = useRef<WsMessage | null>(null);

  useEffect(() => {
    if (!rawMessage || rawMessage === prevRawRef.current) return;
    prevRawRef.current = rawMessage;

    if (rawMessage.type === "market_status") {
      setIsMarketOpen(rawMessage.isOpen as boolean);
      setNextMarketOpen((rawMessage.nextOpen as string) ?? null);
      return;
    }

    if (rawMessage.type === "alert") {
      toast({
        title: `Alert: ${rawMessage.symbol as string}`,
        description: (rawMessage.message as string) ?? `Alert triggered for ${rawMessage.symbol as string}`,
      });
      return;
    }

    setFilteredMessage(rawMessage);
  }, [rawMessage]);

  return (
    <WebSocketContext.Provider value={{ lastMessage: filteredMessage, status, send, isMarketOpen, nextMarketOpen }}>
      {children}
    </WebSocketContext.Provider>
  );
}
