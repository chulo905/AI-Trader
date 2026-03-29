import { logger } from "./logger";

const YF_BASE = "https://query1.finance.yahoo.com";

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number | null;
  marketCap: number | null;
  high52w: number | null;
  low52w: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  open: number | null;
  previousClose: number | null;
  bid: number | null;
  ask: number | null;
  pe: number | null;
  eps: number | null;
  beta: number | null;
}

export interface OHLCVBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; trading-terminal/1.0)",
  "Accept": "application/json",
};

async function fetchYF(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: DEFAULT_HEADERS });
  if (res.status === 429) {
    throw new Error(`Yahoo Finance rate limited (429) for ${url}`);
  }
  if (!res.ok) {
    throw new Error(`Yahoo Finance error ${res.status} for ${url}`);
  }
  return res.json();
}

export async function getYahooQuote(symbol: string): Promise<Quote> {
  const url = `${YF_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d&includePrePost=false`;
  const raw = await fetchYF(url) as Record<string, unknown>;

  const result = (raw?.chart as Record<string, unknown>)?.result as unknown[];
  if (!result || result.length === 0) {
    throw new Error(`Yahoo Finance: no data for ${symbol}`);
  }

  const item = result[0] as Record<string, unknown>;
  const meta = item.meta as Record<string, unknown>;

  if (!meta) {
    throw new Error(`Yahoo Finance: missing meta for ${symbol}`);
  }

  const price = (meta.regularMarketPrice as number) ?? (meta.previousClose as number) ?? 0;
  const previousClose = (meta.chartPreviousClose as number) ?? (meta.previousClose as number) ?? price;
  const change = price - previousClose;
  const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;

  return {
    symbol: (meta.symbol as string) ?? symbol,
    name: (meta.longName as string) ?? (meta.shortName as string) ?? symbol,
    price: Math.round(price * 1000) / 1000,
    change: Math.round(change * 1000) / 1000,
    changePercent: Math.round(changePercent * 1000) / 1000,
    volume: (meta.regularMarketVolume as number) ?? 0,
    avgVolume: (meta.averageDailyVolume3Month as number) ?? null,
    marketCap: null,
    high52w: (meta.fiftyTwoWeekHigh as number) ?? null,
    low52w: (meta.fiftyTwoWeekLow as number) ?? null,
    dayHigh: (meta.regularMarketDayHigh as number) ?? null,
    dayLow: (meta.regularMarketDayLow as number) ?? null,
    open: (meta.regularMarketOpen as number) ?? null,
    previousClose,
    bid: null,
    ask: null,
    pe: null,
    eps: null,
    beta: null,
  };
}

const INTERVAL_MAP: Record<string, string> = {
  "1d": "1d",
  "1wk": "1wk",
  "1mo": "1mo",
};

const PERIOD_RANGE_MAP: Record<string, string> = {
  "1D": "1d",
  "5D": "5d",
  "1M": "1mo",
  "3M": "3mo",
  "6M": "6mo",
  "1Y": "1y",
};

export async function getYahooHistory(symbol: string, timeframe: string, period: string): Promise<OHLCVBar[]> {
  const interval = INTERVAL_MAP[timeframe] ?? "1d";
  const range = PERIOD_RANGE_MAP[period] ?? "1mo";

  const url = `${YF_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
  const raw = await fetchYF(url) as Record<string, unknown>;

  const result = (raw?.chart as Record<string, unknown>)?.result as unknown[];
  if (!result || result.length === 0) {
    throw new Error(`Yahoo Finance history: no data for ${symbol}`);
  }

  const item = result[0] as Record<string, unknown>;
  const timestamps = item.timestamp as number[] | undefined;
  const indicators = item.indicators as Record<string, unknown> | undefined;
  const quote = ((indicators?.quote as unknown[]) ?? [])[0] as Record<string, number[]> | undefined;

  if (!timestamps || !quote) {
    throw new Error(`Yahoo Finance history: missing OHLCV data for ${symbol}`);
  }

  const opens = quote.open ?? [];
  const highs = quote.high ?? [];
  const lows = quote.low ?? [];
  const closes = quote.close ?? [];
  const volumes = quote.volume ?? [];

  const bars: OHLCVBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    const v = volumes[i];

    if (ts == null || o == null || h == null || l == null || c == null) continue;
    if (!isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c)) continue;

    bars.push({
      time: new Date(ts * 1000).toISOString(),
      open: Math.round(o * 1000) / 1000,
      high: Math.round(h * 1000) / 1000,
      low: Math.round(l * 1000) / 1000,
      close: Math.round(c * 1000) / 1000,
      volume: v ?? 0,
    });
  }

  if (bars.length === 0) {
    throw new Error(`Yahoo Finance history: empty bars for ${symbol}`);
  }

  logger.info({ symbol, timeframe, period, count: bars.length }, "Yahoo Finance history fetched");
  return bars;
}
