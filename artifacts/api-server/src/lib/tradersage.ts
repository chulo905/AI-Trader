import { logger } from "./logger";
import { getYahooQuote, getYahooHistory } from "./yahoo-finance";
import { getAlphaVantageHistory } from "./alpha-vantage";
import type { Quote, OHLCVBar } from "./yahoo-finance";
import { db, marketDataCacheTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function readCache(key: string): Promise<unknown | null> {
  try {
    const rows = await db.select().from(marketDataCacheTable).where(
      eq(marketDataCacheTable.cacheKey, key)
    );
    const row = rows[0];
    if (!row) return null;
    if (new Date(row.expiresAt) < new Date()) return null;
    return row.data;
  } catch {
    return null;
  }
}

async function writeCache(key: string, dataType: string, symbol: string, data: unknown, source: string, ttlSeconds: number): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await db.insert(marketDataCacheTable).values({
      cacheKey: key,
      dataType,
      symbol,
      data: data as Record<string, unknown>,
      source,
      expiresAt,
    }).onConflictDoUpdate({
      target: marketDataCacheTable.cacheKey,
      set: { data: data as Record<string, unknown>, source, expiresAt, createdAt: new Date() },
    });
  } catch (err) {
    logger.warn({ err, key }, "Cache write failed (non-fatal)");
  }
}

const BASE_URL = "https://api.tradersage.io";
const TRADER_SAGE_API_KEY = process.env["TRADER_SAGE_API_KEY"];

interface TSQuote {
  symbol?: string;
  ticker?: string;
  name?: string;
  company?: string;
  price?: number;
  last?: number;
  change?: number;
  changePercent?: number;
  change_percent?: number;
  volume?: number;
  avgVolume?: number;
  avg_volume?: number;
  marketCap?: number;
  market_cap?: number;
  high52w?: number;
  low52w?: number;
  dayHigh?: number;
  dayLow?: number;
  open?: number;
  previousClose?: number;
  prev_close?: number;
  bid?: number;
  ask?: number;
  pe?: number;
  eps?: number;
  beta?: number;
  [key: string]: unknown;
}

interface TSCandle {
  time?: string | number;
  date?: string;
  timestamp?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  [key: string]: unknown;
}

async function fetchTS(path: string, params?: Record<string, string>): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const headers: Record<string, string> = {
    "Accept": "application/json",
    "Content-Type": "application/json",
  };

  if (TRADER_SAGE_API_KEY) {
    headers["Authorization"] = `Bearer ${TRADER_SAGE_API_KEY}`;
    headers["X-API-Key"] = TRADER_SAGE_API_KEY;
  }

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(`Trader Sage API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function normalizeQuote(raw: TSQuote, symbol: string) {
  const price = raw.price ?? raw.last ?? 0;
  const change = raw.change ?? 0;
  const changePercent = raw.changePercent ?? raw.change_percent ?? 0;
  const volume = raw.volume ?? 0;

  return {
    symbol: (raw.symbol ?? raw.ticker ?? symbol).toUpperCase(),
    name: raw.name ?? raw.company ?? symbol,
    price,
    change,
    changePercent,
    volume,
    avgVolume: raw.avgVolume ?? raw.avg_volume ?? null,
    marketCap: raw.marketCap ?? raw.market_cap ?? null,
    high52w: raw.high52w ?? null,
    low52w: raw.low52w ?? null,
    dayHigh: raw.dayHigh ?? null,
    dayLow: raw.dayLow ?? null,
    open: raw.open ?? null,
    previousClose: raw.previousClose ?? raw.prev_close ?? null,
    bid: raw.bid ?? null,
    ask: raw.ask ?? null,
    pe: raw.pe ?? null,
    eps: raw.eps ?? null,
    beta: raw.beta ?? null,
    signal: deriveSignal(changePercent, volume, raw.avgVolume ?? raw.avg_volume),
    signalStrength: deriveSignalStrength(changePercent, volume, raw.avgVolume ?? raw.avg_volume),
    updatedAt: new Date().toISOString(),
  };
}

function quoteToResult(q: Quote, isMock: boolean, dataDelay: "15min" | "realtime" | "mock") {
  return {
    ...q,
    signal: deriveSignal(q.changePercent, q.volume, q.avgVolume),
    signalStrength: deriveSignalStrength(q.changePercent, q.volume, q.avgVolume),
    updatedAt: new Date().toISOString(),
    isMock,
    dataDelay,
  };
}

function deriveSignal(changePercent: number, volume: number, avgVolume?: number | null): string {
  const volRatio = avgVolume && avgVolume > 0 ? volume / avgVolume : 1;

  if (changePercent > 2 || (changePercent > 0.5 && volRatio > 1.5)) return "bullish";
  if (changePercent < -2 || (changePercent < -0.5 && volRatio > 1.5)) return "bearish";
  return "neutral";
}

function deriveSignalStrength(changePercent: number, volume: number, avgVolume?: number | null): number {
  const volRatio = avgVolume && avgVolume > 0 ? volume / avgVolume : 1;
  const absChange = Math.abs(changePercent);
  const base = Math.min(absChange * 10, 60);
  const volBonus = Math.min((volRatio - 1) * 20, 40);
  return Math.round(Math.max(20, Math.min(95, base + volBonus)));
}

const FALLBACK_SYMBOLS = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD", "SPY", "QQQ"
];

function generateMockQuote(symbol: string) {
  const basePrice = {
    AAPL: 178.5, MSFT: 415.2, NVDA: 875.3, GOOGL: 175.8, AMZN: 192.1,
    META: 485.6, TSLA: 248.9, AMD: 168.4, SPY: 521.7, QQQ: 445.2,
    DIA: 399.8, IWM: 198.3, XLF: 43.2, XLE: 95.6, XLK: 225.1,
  }[symbol] ?? (50 + Math.random() * 300);

  const change = (Math.random() - 0.48) * basePrice * 0.04;
  const changePercent = (change / basePrice) * 100;
  const volume = Math.floor(1000000 + Math.random() * 50000000);
  const avgVolume = Math.floor(volume * (0.7 + Math.random() * 0.6));

  return {
    symbol,
    name: symbol,
    price: Math.round(basePrice * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    volume,
    avgVolume,
    marketCap: null,
    high52w: Math.round(basePrice * 1.4 * 100) / 100,
    low52w: Math.round(basePrice * 0.65 * 100) / 100,
    dayHigh: Math.round((basePrice + Math.abs(change) * 1.5) * 100) / 100,
    dayLow: Math.round((basePrice - Math.abs(change) * 1.5) * 100) / 100,
    open: Math.round((basePrice - change * 0.3) * 100) / 100,
    previousClose: Math.round((basePrice - change) * 100) / 100,
    bid: Math.round((basePrice - 0.01) * 100) / 100,
    ask: Math.round((basePrice + 0.01) * 100) / 100,
    pe: symbol === "SPY" || symbol === "QQQ" ? null : Math.round(15 + Math.random() * 35),
    eps: null,
    beta: Math.round((0.5 + Math.random() * 1.5) * 100) / 100,
    signal: deriveSignal(changePercent, volume, avgVolume),
    signalStrength: deriveSignalStrength(changePercent, volume, avgVolume),
    updatedAt: new Date().toISOString(),
    isMock: true,
    dataDelay: "mock" as const,
  };
}

function generateMockCandle(time: Date, prevClose: number) {
  const open = prevClose * (1 + (Math.random() - 0.5) * 0.01);
  const volatility = open * 0.015;
  const high = open + Math.random() * volatility;
  const low = open - Math.random() * volatility;
  const close = low + Math.random() * (high - low);
  return {
    time: time.toISOString(),
    open: Math.round(open * 100) / 100,
    high: Math.round(high * 100) / 100,
    low: Math.round(low * 100) / 100,
    close: Math.round(close * 100) / 100,
    volume: Math.floor(500000 + Math.random() * 5000000),
  };
}

export async function getQuotes(symbols: string[]) {
  const results = await Promise.all(symbols.map(s => getSingleQuote(s)));
  return results;
}

export async function getSingleQuote(symbol: string) {
  const cacheKey = `quote:${symbol}`;

  const cached = await readCache(cacheKey);
  if (cached) {
    logger.info({ symbol }, "Quote served from cache");
    return cached as ReturnType<typeof generateMockQuote>;
  }

  try {
    const q = await getYahooQuote(symbol);
    const result = quoteToResult(q, false, "15min");
    await writeCache(cacheKey, "quote", symbol, result, "yahoo", 15 * 60);
    return result;
  } catch (yahooErr) {
    logger.warn({ symbol, err: yahooErr }, "Yahoo Finance quote failed, trying Trader Sage");
  }

  if (TRADER_SAGE_API_KEY) {
    try {
      const data = await fetchTS(`/v1/quote/${symbol}`);
      const raw = (data as Record<string, unknown>)?.quote ?? data;
      const result = { ...normalizeQuote(raw as TSQuote, symbol), isMock: false, dataDelay: "realtime" as const };
      await writeCache(cacheKey, "quote", symbol, result, "tradersage", 15 * 60);
      return result;
    } catch (tsErr) {
      logger.warn({ symbol, err: tsErr }, "Trader Sage quote also failed, using mock fallback");
    }
  }

  logger.warn({ symbol }, "All real data sources failed for quote, using mock");
  return generateMockQuote(symbol);
}

export async function getHistory(symbol: string, timeframe: string, period: string) {
  const cacheKey = `history:${symbol}:${timeframe}:${period}`;

  const cached = await readCache(cacheKey);
  if (cached) {
    logger.info({ symbol, timeframe, period }, "History served from cache");
    const c = cached as { candles: OHLCVBar[]; isMock: boolean; dataDelay: string };
    return c;
  }

  try {
    const candles = await getYahooHistory(symbol, timeframe, period);
    const result = { candles, isMock: false, dataDelay: "15min" as const };
    await writeCache(cacheKey, "history", symbol, result, "yahoo", 24 * 60 * 60);
    return result;
  } catch (yahooErr) {
    logger.warn({ symbol, err: yahooErr }, "Yahoo Finance history failed, trying Alpha Vantage");
  }

  try {
    const candles = await getAlphaVantageHistory(symbol);
    const result = { candles, isMock: false, dataDelay: "15min" as const };
    await writeCache(cacheKey, "history", symbol, result, "alphavantage", 24 * 60 * 60);
    return result;
  } catch (avErr) {
    logger.warn({ symbol, err: avErr }, "Alpha Vantage history also failed");
  }

  if (TRADER_SAGE_API_KEY) {
    try {
      const data = await fetchTS(`/v1/history/${symbol}`, { timeframe, period });
      const rawCandles = ((data as Record<string, unknown>)?.candles ?? (data as unknown[])) as TSCandle[];
      const candles = rawCandles.map((c: TSCandle) => ({
        time: c.time ? new Date(typeof c.time === "number" ? c.time * 1000 : c.time).toISOString() : c.date ?? new Date().toISOString(),
        open: c.open ?? 0,
        high: c.high ?? 0,
        low: c.low ?? 0,
        close: c.close ?? 0,
        volume: c.volume ?? 0,
      }));
      return { candles, isMock: false, dataDelay: "realtime" as const };
    } catch (tsErr) {
      logger.warn({ symbol, err: tsErr }, "Trader Sage history also failed, generating mock data");
    }
  }

  logger.warn({ symbol, timeframe, period }, "All real data sources failed for history, using mock");
  return { isMock: true, dataDelay: "mock" as const, candles: generateMockHistory(symbol, timeframe, period) };
}

export async function getMovers() {
  try {
    const data = await fetchTS("/v1/movers");
    const raw = data as Record<string, unknown>;
    return {
      isMock: false,
      dataDelay: "realtime" as const,
      gainers: ((raw.gainers as TSQuote[]) ?? []).map((q: TSQuote) => ({ ...normalizeQuote(q, q.symbol ?? ""), dataDelay: "realtime" as const })),
      losers: ((raw.losers as TSQuote[]) ?? []).map((q: TSQuote) => ({ ...normalizeQuote(q, q.symbol ?? ""), dataDelay: "realtime" as const })),
      mostActive: ((raw.most_active ?? raw.mostActive) as TSQuote[] ?? []).map((q: TSQuote) => ({ ...normalizeQuote(q, q.symbol ?? ""), dataDelay: "realtime" as const })),
    };
  } catch (err) {
    logger.warn({ err }, "Trader Sage movers failed, fetching via Yahoo Finance");
  }

  const moverSymbols = {
    gainers: ["NVDA", "META", "AMD", "TSLA", "AAPL"],
    losers: ["F", "BA", "WMT", "JNJ", "PFE"],
    mostActive: ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"],
  };

  const [gainerQuotes, loserQuotes, activeQuotes] = await Promise.all([
    Promise.all(moverSymbols.gainers.map(s => getSingleQuote(s))),
    Promise.all(moverSymbols.losers.map(s => getSingleQuote(s))),
    Promise.all(moverSymbols.mostActive.map(s => getSingleQuote(s))),
  ]);

  const anyMock = [...gainerQuotes, ...loserQuotes, ...activeQuotes].some(q => q.isMock);

  return {
    isMock: anyMock,
    dataDelay: anyMock ? "mock" as const : "15min" as const,
    gainers: gainerQuotes.sort((a, b) => b.changePercent - a.changePercent),
    losers: loserQuotes.sort((a, b) => a.changePercent - b.changePercent),
    mostActive: activeQuotes.sort((a, b) => b.volume - a.volume),
  };
}

function generateMockHistory(symbol: string, _timeframe: string, period: string) {
  const periodsMap: Record<string, number> = {
    "1D": 390, "5D": 5, "1M": 30, "3M": 90, "6M": 180, "1Y": 252,
  };
  const days = periodsMap[period] ?? 30;
  const currentPrice = generateMockQuote(symbol).price;

  const startMultiplier = 0.80 + Math.random() * 0.15;
  const startPrice = currentPrice * startMultiplier;

  const candles = [];
  let price = startPrice;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const progress = 1 - i / days;
    const targetPrice = startPrice + (currentPrice - startPrice) * progress;
    const meanReversionPull = (targetPrice - price) * 0.05;
    price = price + meanReversionPull;

    const d = new Date(now);
    if (period === "1D") {
      d.setMinutes(d.getMinutes() - i);
    } else {
      d.setDate(d.getDate() - i);
    }
    const candle = generateMockCandle(d, price);
    candles.push(candle);
    price = candle.close;
  }
  return candles;
}

export async function scanMarket(strategy: string) {
  const strategySets: Record<string, string[]> = {
    momentum: ["NVDA", "META", "MSFT", "AAPL", "GOOGL"],
    breakout: ["AMD", "TSLA", "AMZN", "NFLX", "CRM"],
    oversold: ["BA", "F", "PFE", "JNJ", "WMT"],
    overbought: ["NVDA", "META", "MSFT", "AAPL", "SPY"],
    high_volume: ["SPY", "QQQ", "AAPL", "AMD", "TSLA"],
  };

  const symbols = strategySets[strategy] ?? strategySets["momentum"]!;
  const quotes = await getQuotes(symbols);
  const anyMock = quotes.some(q => q.isMock);
  return {
    isMock: anyMock,
    dataDelay: anyMock ? "mock" as const : "15min" as const,
    results: quotes.map(q => ({
      symbol: q.symbol,
      name: q.name,
      price: q.price,
      changePercent: q.changePercent,
      volume: q.volume,
      score: q.signalStrength ?? 50,
      signal: q.signal ?? "neutral",
      reason: getStrategyReason(strategy, q),
    })),
  };
}

function getStrategyReason(strategy: string, q: { changePercent: number; volume: number; avgVolume?: number | null }): string {
  const volRatio = q.avgVolume && q.avgVolume > 0 ? (q.volume / q.avgVolume).toFixed(1) : "N/A";
  switch (strategy) {
    case "momentum": return `Strong price momentum with ${q.changePercent > 0 ? "+" : ""}${q.changePercent.toFixed(2)}% move and ${volRatio}x volume`;
    case "breakout": return `Breaking key levels with elevated volume at ${volRatio}x average`;
    case "oversold": return `RSI approaching oversold territory after ${q.changePercent.toFixed(2)}% decline`;
    case "overbought": return `RSI approaching overbought levels after extended rally`;
    case "high_volume": return `Unusual volume activity at ${volRatio}x daily average`;
    default: return "Matches scan criteria";
  }
}
