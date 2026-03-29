import { Router, type IRouter } from "express";
import { getHistory } from "../lib/tradersage";
import { detectMarketRegime } from "../lib/market-regime";
import { type OHLCVBar } from "../lib/technicals";

const router: IRouter = Router();

const regimeCache = new Map<string, { data: ReturnType<typeof detectMarketRegime>; expiresAt: number }>();
const CACHE_TTL = 10 * 60 * 1000;

router.get("/:symbol", async (req, res) => {
  const symbol = req.params["symbol"]!.toUpperCase();
  const cached = regimeCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.data);
    return;
  }

  try {
    const { candles, isMock } = await getHistory(symbol, "1d", "6M");
    const bars: OHLCVBar[] = candles.map(h => ({
      time: h.time, open: h.open, high: h.high, low: h.low, close: h.close, volume: h.volume,
    }));
    const result = detectMarketRegime(bars, symbol);
    regimeCache.set(symbol, { data: result, expiresAt: Date.now() + CACHE_TTL });
    res.json({ ...result, isMock });
  } catch (err) {
    res.status(500).json({ error: "Failed to detect market regime" });
  }
});

export default router;
