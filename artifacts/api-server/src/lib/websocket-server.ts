import { WebSocketServer, type WebSocket } from "ws";
import { IncomingMessage, Server as HttpServer } from "http";
import { getSingleQuote } from "./tradersage";
import { isMarketOpen } from "./market-hours";
import { logger } from "./logger";
import { db, tradesTable, watchlistsTable, alertsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

interface TickMessage {
  type: "tick";
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

interface MarketStatusMessage {
  type: "market_status";
  isOpen: boolean;
  nextOpen: string | null;
}

interface AlertPushMessage {
  type: "alert";
  symbol: string;
  message: string;
  alertType: string;
}

interface SubscribeMessage {
  type: "subscribe" | "unsubscribe";
  symbol: string;
}

const clientSubscriptions = new Map<WebSocket, Set<string>>();
const priceCache = new Map<string, { price: number; change: number; changePercent: number; lastFetched: number }>();
const PRICE_FETCH_INTERVAL = 15 * 1000;
const BROADCAST_INTERVAL = 5 * 1000;

let wss: WebSocketServer | null = null;
let broadcastTimer: ReturnType<typeof setInterval> | null = null;
let prevMarketOpen: boolean | null = null;

function getNextMarketOpenISO(): string | null {
  const now = new Date();

  for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
    const candidate = new Date(now);
    candidate.setUTCDate(now.getUTCDate() + daysAhead);
    const weekday = candidate.getUTCDay();
    if (weekday >= 1 && weekday <= 5) {
      candidate.setUTCHours(13, 30, 0, 0);
      return candidate.toISOString();
    }
  }
  return null;
}

async function fetchPrice(symbol: string): Promise<{ price: number; change: number; changePercent: number } | null> {
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.lastFetched < PRICE_FETCH_INTERVAL) {
    return { price: cached.price, change: cached.change, changePercent: cached.changePercent };
  }

  try {
    const quote = await getSingleQuote(symbol);
    const entry = { price: quote.price, change: quote.change ?? 0, changePercent: quote.changePercent, lastFetched: Date.now() };
    priceCache.set(symbol, entry);
    return { price: entry.price, change: entry.change, changePercent: entry.changePercent };
  } catch {
    return cached ? { price: cached.price, change: cached.change, changePercent: cached.changePercent } : null;
  }
}

function getClientSubscribedSymbols(): Set<string> {
  const symbols = new Set<string>();
  for (const subs of clientSubscriptions.values()) {
    for (const sym of subs) symbols.add(sym);
  }
  return symbols;
}

async function getWatchedSymbols(): Promise<Set<string>> {
  const symbols = new Set<string>();

  try {
    const openTrades = await db.select({ symbol: tradesTable.symbol })
      .from(tradesTable)
      .where(eq(tradesTable.status, "open"));
    for (const t of openTrades) symbols.add(t.symbol.toUpperCase());
  } catch (err) {
    logger.error({ err }, "WS: Failed to load open positions for tick broadcast");
  }

  try {
    const watchlists = await db.select({ symbols: watchlistsTable.symbols }).from(watchlistsTable);
    for (const w of watchlists) {
      for (const sym of (w.symbols as string[])) symbols.add(sym.toUpperCase());
    }
  } catch (err) {
    logger.error({ err }, "WS: Failed to load watchlist symbols for tick broadcast");
  }

  const clientSubs = getClientSubscribedSymbols();
  for (const sym of clientSubs) symbols.add(sym);

  return symbols;
}

function broadcastToAll(msg: object) {
  if (!wss) return;
  const json = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(json);
    }
  }
}

async function broadcastPrices() {
  if (!wss || wss.clients.size === 0) return;

  const marketOpen = isMarketOpen();

  if (prevMarketOpen !== null && prevMarketOpen !== marketOpen) {
    broadcastMarketStatus(marketOpen);
  }
  prevMarketOpen = marketOpen;

  if (!marketOpen) return;

  const symbols = await getWatchedSymbols();
  if (symbols.size === 0) return;

  await Promise.all(Array.from(symbols).map(async (symbol) => {
    const data = await fetchPrice(symbol);
    if (!data) return;

    const tick: TickMessage = {
      type: "tick",
      symbol,
      price: data.price,
      change: data.change,
      changePercent: data.changePercent,
      timestamp: new Date().toISOString(),
    };

    const json = JSON.stringify(tick);

    for (const [client, subs] of clientSubscriptions.entries()) {
      if (subs.has(symbol) && client.readyState === 1) {
        client.send(json);
      }
    }
  }));

  await checkAndPushAlerts(symbols);
}

async function checkAndPushAlerts(symbols: Set<string>) {
  try {
    const activeAlerts = await db.select().from(alertsTable)
      .where(and(eq(alertsTable.isActive, true), eq(alertsTable.isTriggered, false)));

    for (const alert of activeAlerts) {
      if (!symbols.has(alert.symbol.toUpperCase())) continue;

      const cached = priceCache.get(alert.symbol.toUpperCase());
      if (!cached) continue;

      let triggered = false;
      if (alert.type === "price_above" && alert.value !== null && cached.price >= alert.value) {
        triggered = true;
      } else if (alert.type === "price_below" && alert.value !== null && cached.price <= alert.value) {
        triggered = true;
      }

      if (triggered) {
        await db.update(alertsTable)
          .set({ isTriggered: true, isActive: false, triggeredAt: new Date() })
          .where(eq(alertsTable.id, alert.id));

        const msg: AlertPushMessage = {
          type: "alert",
          symbol: alert.symbol,
          message: alert.message ?? `${alert.symbol} price alert triggered at $${cached.price.toFixed(2)}`,
          alertType: alert.type,
        };

        broadcastToAll(msg);
        logger.info({ symbol: alert.symbol, type: alert.type }, "WS: Alert triggered and pushed");
      }
    }
  } catch (err) {
    logger.error({ err }, "WS: Failed to check alerts");
  }
}

function broadcastMarketStatus(open: boolean) {
  const msg: MarketStatusMessage = {
    type: "market_status",
    isOpen: open,
    nextOpen: open ? null : getNextMarketOpenISO(),
  };
  broadcastToAll(msg);
}

export function createWebSocketServer(server: HttpServer) {
  if (wss) return wss;

  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    logger.debug({ remoteAddress: req.socket.remoteAddress }, "WebSocket client connected");
    clientSubscriptions.set(ws, new Set());

    ws.send(JSON.stringify({ type: "connected", message: "AI Trading Terminal WebSocket connected." }));

    const marketOpen = isMarketOpen();
    prevMarketOpen = marketOpen;
    ws.send(JSON.stringify({
      type: "market_status",
      isOpen: marketOpen,
      nextOpen: marketOpen ? null : getNextMarketOpenISO(),
    } as MarketStatusMessage));

    ws.on("message", (data) => {
      try {
        const msg: SubscribeMessage = JSON.parse(data.toString());
        const subs = clientSubscriptions.get(ws)!;

        if (msg.type === "subscribe" && msg.symbol) {
          const sym = msg.symbol.toUpperCase();
          subs.add(sym);
          ws.send(JSON.stringify({ type: "subscribed", symbol: sym }));
          fetchPrice(sym).then(d => {
            if (d && ws.readyState === 1) {
              ws.send(JSON.stringify({
                type: "tick",
                symbol: sym,
                price: d.price,
                change: d.change,
                changePercent: d.changePercent,
                timestamp: new Date().toISOString(),
              } as TickMessage));
            }
          });
        } else if (msg.type === "unsubscribe" && msg.symbol) {
          subs.delete(msg.symbol.toUpperCase());
          ws.send(JSON.stringify({ type: "unsubscribed", symbol: msg.symbol.toUpperCase() }));
        }
      } catch (err) {
        logger.error({ err }, "WebSocket error parsing message");
      }
    });

    ws.on("close", () => {
      clientSubscriptions.delete(ws);
      logger.debug("WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });
  });

  if (!broadcastTimer) {
    broadcastTimer = setInterval(broadcastPrices, BROADCAST_INTERVAL);
  }

  logger.info("WebSocket server started on /ws");
  return wss;
}

export function broadcastAlertPush(symbol: string, message: string, alertType: string) {
  broadcastToAll({ type: "alert", symbol, message, alertType } as AlertPushMessage);
}

export function getWebSocketStats() {
  return {
    connected: wss ? wss.clients.size : 0,
    subscribedSymbols: Array.from(getClientSubscribedSymbols()),
    running: !!wss,
  };
}
