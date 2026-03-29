import { useEffect, useRef, useState, useCallback } from "react";

export type WsStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface WsMessage {
  type: string;
  [key: string]: unknown;
}

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const MAX_RETRIES = 10;

function getWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${proto}//${host}/ws`;
}

export interface UseWebSocketReturn {
  lastMessage: WsMessage | null;
  status: WsStatus;
  send: (msg: object) => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [status, setStatus] = useState<WsStatus>("connecting");
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const url = getWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    setStatus(retryCountRef.current > 0 ? "reconnecting" : "connecting");

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      retryCountRef.current = 0;
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      if (unmountedRef.current) return;
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        setLastMessage(msg);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      wsRef.current = null;

      if (retryCountRef.current >= MAX_RETRIES) {
        setStatus("disconnected");
        return;
      }

      const delay = Math.min(BASE_DELAY_MS * 2 ** retryCountRef.current, MAX_DELAY_MS);
      retryCountRef.current += 1;
      setStatus("reconnecting");
      retryTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((msg: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { lastMessage, status, send };
}
