import { Router, type IRouter } from "express";
import { getHistory } from "../lib/tradersage";
import { runBacktest } from "../lib/backtester";
import { type OHLCVBar } from "../lib/technicals";

const router: IRouter = Router();

const backtestCache = new Map<string, { data: ReturnType<typeof runBacktest>; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

router.get("/:symbol", async (req, res) => {
  const symbol = req.params["symbol"]!.toUpperCase();
  const period = (req.query["period"] as string) ?? "3M";
  const budget = parseFloat((req.query["budget"] as string) ?? "1000");

  const cacheKey = `${symbol}-${period}`;
  const cached = backtestCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.data);
    return;
  }

  try {
    const history = await getHistory(symbol, "1d", period);
    const bars: OHLCVBar[] = history.map(h => ({
      time: h.time, open: h.open, high: h.high, low: h.low, close: h.close, volume: h.volume,
    }));

    if (bars.length < 30) {
      res.status(400).json({ error: "Not enough historical data for backtest. Try a longer period." });
      return;
    }

    const result = runBacktest(bars, symbol, period, budget);
    backtestCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL });
    res.json(result);
  } catch (err) {
    console.error("[Backtest]", err);
    res.status(500).json({ error: "Backtest failed" });
  }
});

export default router;
