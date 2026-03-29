import { logger } from "./logger";
import type { OHLCVBar } from "./yahoo-finance";

const AV_BASE = "https://www.alphavantage.co/query";
const AV_API_KEY = process.env["ALPHA_VANTAGE_API_KEY"];

interface AVDailyEntry {
  "1. open": string;
  "2. high": string;
  "3. low": string;
  "4. close": string;
  "5. volume": string;
}

export async function getAlphaVantageHistory(symbol: string): Promise<OHLCVBar[]> {
  if (!AV_API_KEY) {
    throw new Error("ALPHA_VANTAGE_API_KEY is not set");
  }

  const url = `${AV_BASE}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${AV_API_KEY}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });

  if (!res.ok) {
    throw new Error(`Alpha Vantage error ${res.status} for ${symbol}`);
  }

  const raw = await res.json() as Record<string, unknown>;

  if (raw["Note"] || raw["Information"]) {
    const msg = (raw["Note"] ?? raw["Information"]) as string;
    throw new Error(`Alpha Vantage limit reached: ${msg}`);
  }

  const timeSeries = raw["Time Series (Daily)"] as Record<string, AVDailyEntry> | undefined;
  if (!timeSeries) {
    throw new Error(`Alpha Vantage: no time series data for ${symbol}`);
  }

  const bars: OHLCVBar[] = Object.entries(timeSeries)
    .map(([date, entry]) => ({
      time: new Date(date).toISOString(),
      open: parseFloat(entry["1. open"]),
      high: parseFloat(entry["2. high"]),
      low: parseFloat(entry["3. low"]),
      close: parseFloat(entry["4. close"]),
      volume: parseInt(entry["5. volume"], 10),
    }))
    .filter(b => isFinite(b.open) && isFinite(b.high) && isFinite(b.low) && isFinite(b.close))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  if (bars.length === 0) {
    throw new Error(`Alpha Vantage: empty bars for ${symbol}`);
  }

  logger.info({ symbol, count: bars.length }, "Alpha Vantage history fetched");
  return bars;
}
