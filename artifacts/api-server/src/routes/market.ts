import { Router, type IRouter } from "express";
import { getQuotes, getSingleQuote, getHistory, getMovers, scanMarket } from "../lib/tradersage";
import { getChronosForecast } from "../lib/chronos";
import { logger } from "../lib/logger";
import { computeIndicators, type OHLCVBar } from "../lib/technicals";

const router: IRouter = Router();

router.get("/quotes", async (req, res) => {
  const symbolsParam = req.query["symbols"] as string;
  if (!symbolsParam) {
    res.status(400).json({ error: "symbols query param required" });
    return;
  }
  const symbols = symbolsParam.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  const data = await getQuotes(symbols);
  res.json(data);
});

router.get("/movers", async (_req, res) => {
  const data = await getMovers();
  res.json(data);
});

router.get("/scan", async (req, res) => {
  const strategy = (req.query["strategy"] as string) ?? "momentum";
  const data = await scanMarket(strategy);
  res.json(data);
});

router.get("/history/:symbol", async (req, res) => {
  const symbol = req.params["symbol"]!.toUpperCase();
  const timeframe = (req.query["timeframe"] as string) ?? "1d";
  const period = (req.query["period"] as string) ?? "1M";
  const { candles, isMock, dataDelay } = await getHistory(symbol, timeframe, period);
  res.json({ candles, isMock, dataDelay: dataDelay ?? (isMock ? "mock" : "15min") });
});

router.get("/quote/:symbol", async (req, res) => {
  const symbol = req.params["symbol"]!.toUpperCase();
  const data = await getSingleQuote(symbol);
  res.json(data);
});

router.get("/:symbol/forecast", async (req, res) => {
  const symbol = req.params["symbol"]!.toUpperCase();
  try {
    const { candles } = await getHistory(symbol, "1d", "3M");
    const closingPrices = candles.map(c => c.close);
    if (closingPrices.length < 10) {
      res.status(422).json({ error: "Insufficient price history for forecast (need at least 10 bars)" });
      return;
    }
    const forecast = await getChronosForecast(symbol, closingPrices);
    res.json(forecast);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Forecast failed";
    logger.warn({ symbol, err }, "Chronos forecast error");
    res.status(503).json({ error: msg });
  }
});

router.get("/:symbol/atr", async (req, res) => {
  try {
    const symbol = req.params["symbol"]!.toUpperCase();
    const { candles, isMock } = await getHistory(symbol, "1d", "1M");
    const bars: OHLCVBar[] = candles.map(h => ({
      time: h.time, open: h.open, high: h.high, low: h.low, close: h.close, volume: h.volume,
    }));
    const indicators = computeIndicators(bars);
    res.json({ symbol, atr14: indicators.atr14, isMock });
  } catch {
    res.status(500).json({ error: "Failed to compute ATR" });
  }
});

export default router;
