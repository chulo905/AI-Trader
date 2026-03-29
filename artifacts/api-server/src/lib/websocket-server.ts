import { WebSocketServer, type WebSocket } from "ws";
import { IncomingMessage, Server as HttpServer } from "http";
import { getSingleQuote } from "./tradersage";

interface PriceUpdate {
  type: "price";
  symbol: string;
  price: number;
  changePercent: number;
  timestamp: string;
}

interface SubscribeMessage {
  type: "subscribe" | "unsubscribe";
  symbol: string;
}

const clientSubscriptions = new Map<WebSocket, Set<string>>();
const priceCache = new Map<string, { price: number; changePercent: number; lastFetched: number }>();
const PRICE_FETCH_INTERVAL = 15 * 1000;
const BROADCAST_INTERVAL = 5 * 1000;

let wss: WebSocketServer | null = null;
let broadcastTimer: ReturnType<typeof setInterval> | null = null;

async function fetchPrice(symbol: string): Promise<{ price: number; changePercent: number } | null> {
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.lastFetched < PRICE_FETCH_INTERVAL) {
    return { price: cached.price, changePercent: cached.changePercent };
  }

  try {
    const quote = await getSingleQuote(symbol);
    priceCache.set(symbol, { price: quote.price, changePercent: quote.changePercent, lastFetched: Date.now() });
    return { price: quote.price, changePercent: quote.changePercent };
  } catch {
    return cached ? { price: cached.price, changePercent: cached.changePercent } : null;
  }
}

function getSubscribedSymbols(): Set<string> {
  const symbols = new Set<string>();
  for (const subs of clientSubscriptions.values()) {
    for (const sym of subs) symbols.add(sym);
  }
  return symbols;
}

async function broadcastPrices() {
  if (!wss || wss.clients.size === 0) return;

  const symbols = getSubscribedSymbols();
  if (symbols.size === 0) return;

  await Promise.all(Array.from(symbols).map(async (symbol) => {
    const data = await fetchPrice(symbol);
    if (!data) return;

    const update: PriceUpdate = {
      type: "price",
      symbol,
      price: data.price,
      changePercent: data.changePercent,
      timestamp: new Date().toISOString(),
    };

    const json = JSON.stringify(update);

    for (const [client, subs] of clientSubscriptions.entries()) {
      if (subs.has(symbol) && client.readyState === 1) {
        client.send(json);
      }
    }
  }));
}

export function createWebSocketServer(server: HttpServer) {
  if (wss) return wss;

  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    console.log(`[WebSocket] Client connected from ${req.socket.remoteAddress}`);
    clientSubscriptions.set(ws, new Set());

    ws.send(JSON.stringify({ type: "connected", message: "AI Trading Terminal WebSocket connected." }));

    ws.on("message", (data) => {
      try {
        const msg: SubscribeMessage = JSON.parse(data.toString());
        const subs = clientSubscriptions.get(ws)!;

        if (msg.type === "subscribe" && msg.symbol) {
          subs.add(msg.symbol.toUpperCase());
          ws.send(JSON.stringify({ type: "subscribed", symbol: msg.symbol.toUpperCase() }));
          fetchPrice(msg.symbol.toUpperCase()).then(d => {
            if (d) {
              ws.send(JSON.stringify({
                type: "price",
                symbol: msg.symbol.toUpperCase(),
                price: d.price,
                changePercent: d.changePercent,
                timestamp: new Date().toISOString(),
              }));
            }
          });
        } else if (msg.type === "unsubscribe" && msg.symbol) {
          subs.delete(msg.symbol.toUpperCase());
          ws.send(JSON.stringify({ type: "unsubscribed", symbol: msg.symbol.toUpperCase() }));
        }
      } catch (err) {
        console.error("[WebSocket] Error parsing message:", err);
      }
    });

    ws.on("close", () => {
      clientSubscriptions.delete(ws);
      console.log("[WebSocket] Client disconnected");
    });

    ws.on("error", (err) => {
      console.error("[WebSocket] Error:", err.message);
    });
  });

  if (!broadcastTimer) {
    broadcastTimer = setInterval(broadcastPrices, BROADCAST_INTERVAL);
  }

  console.log("[WebSocket] Server started on /ws");
  return wss;
}

export function getWebSocketStats() {
  return {
    connected: wss ? wss.clients.size : 0,
    subscribedSymbols: Array.from(getSubscribedSymbols()),
    running: !!wss,
  };
}
