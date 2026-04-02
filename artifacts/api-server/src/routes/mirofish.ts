import { Router, type NextFunction, type Request, type Response, type IRouter } from "express";
import { db, mirofishSimulationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { runMirofishSwarm, getCachedSwarmResult, SWARM_AGENTS, type MarketSnapshot } from "../lib/mirofish.js";
import { getSingleQuote, getHistory } from "../lib/tradersage.js";
import { computeIndicators, type OHLCVBar } from "../lib/technicals.js";
import { detectMarketRegime } from "../lib/market-regime.js";
import { getSentiment } from "../lib/sentiment.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

async function buildSnapshot(symbol: string): Promise<MarketSnapshot> {
  const [quote, histResult] = await Promise.all([
    getSingleQuote(symbol),
    getHistory(symbol, "1d", "3M"),
  ]);

  const bars: OHLCVBar[] = histResult.candles.map(h => ({
    time: h.time, open: h.open, high: h.high, low: h.low, close: h.close, volume: h.volume,
  }));

  const indicators = bars.length >= 14 ? computeIndicators(bars) : null;
  const regime = bars.length >= 50 ? detectMarketRegime(bars, symbol) : null;

  let sentimentScore: number | undefined;
  let overallSentiment: string | undefined;
  try {
    const sent = await getSentiment(symbol, quote.price, quote.changePercent);
    sentimentScore = sent.score;
    overallSentiment = sent.overallSentiment;
  } catch {
    /* sentiment is optional */
  }

  const price = quote.price;
  const sma50 = indicators?.sma50 ?? price;
  const sma200 = indicators?.sma200 ?? price;
  const sma50pct = sma50 > 0 ? ((price - sma50) / sma50) * 100 : 0;
  const sma200pct = sma200 > 0 ? ((price - sma200) / sma200) * 100 : 0;

  return {
    symbol,
    price,
    changePercent: quote.changePercent,
    rsi14: indicators?.rsi14 ?? 50,
    macdSignal: indicators?.macdHistogram ?? 0,
    atr14: indicators?.atr14 ?? price * 0.015,
    sma50pct,
    sma200pct,
    regime: regime?.regime ?? "neutral",
    sentimentScore,
    overallSentiment,
    volume: quote.volume,
    isMock: quote.isMock,
  };
}

router.post("/:symbol/run", async (req: Request, res: Response, next: NextFunction) => {
  const symbol = String(req.params["symbol"]).toUpperCase();
  try {
    const snap = await buildSnapshot(symbol);
    const result = await runMirofishSwarm(snap);

    await db.insert(mirofishSimulationsTable).values({
      symbol: result.symbol,
      price: result.price,
      action: result.action,
      confidence: result.confidence,
      dissentScore: result.dissentScore,
      agentVotes: result.agentVotes,
      synthesisReport: result.synthesisReport,
      roundOneSummary: result.roundOneSummary,
      roundTwoSummary: result.roundTwoSummary,
      swarmScore: result.swarmScore,
      bullAgents: result.bullAgents,
      bearAgents: result.bearAgents,
      holdAgents: result.holdAgents,
      durationMs: result.durationMs,
    }).onConflictDoNothing();

    res.json(result);
  } catch (err) {
    logger.error({ symbol, err }, "MiroFish simulation failed");
    next(err);
  }
});

router.get("/:symbol/latest", async (req: Request, res: Response, next: NextFunction) => {
  const symbol = String(req.params["symbol"]).toUpperCase();
  try {
    const cached = getCachedSwarmResult(symbol);
    if (cached) {
      res.json({ ...cached, source: "cache" });
      return;
    }

    const [row] = await db
      .select()
      .from(mirofishSimulationsTable)
      .where(eq(mirofishSimulationsTable.symbol, symbol))
      .orderBy(desc(mirofishSimulationsTable.runAt))
      .limit(1);

    if (!row) {
      res.status(404).json({
        error: "No simulation found",
        code: "NO_SIMULATION",
        message: `No MiroFish simulation has been run for ${symbol} yet. Run a simulation first.`,
      });
      return;
    }

    res.json({
      ...row,
      agentVotes: row.agentVotes as object[],
      runAt: row.runAt.toISOString(),
      source: "db",
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:symbol/history", async (req: Request, res: Response, next: NextFunction) => {
  const symbol = String(req.params["symbol"]).toUpperCase();
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query["limit"] ?? "10"), 10) || 10));
  try {
    const rows = await db
      .select()
      .from(mirofishSimulationsTable)
      .where(eq(mirofishSimulationsTable.symbol, symbol))
      .orderBy(desc(mirofishSimulationsTable.runAt))
      .limit(limit);

    res.json(rows.map(r => ({
      ...r,
      agentVotes: r.agentVotes,
      runAt: r.runAt.toISOString(),
    })));
  } catch (err) {
    next(err);
  }
});

router.get("/agents", (_req: Request, res: Response) => {
  res.json(SWARM_AGENTS.map(a => ({
    id: a.id,
    name: a.name,
    role: a.role,
    focusOn: a.focusOn,
  })));
});

router.get("/history", async (req: Request, res: Response, next: NextFunction) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"), 10) || 20));
  try {
    const rows = await db
      .select()
      .from(mirofishSimulationsTable)
      .orderBy(desc(mirofishSimulationsTable.runAt))
      .limit(limit);

    res.json(rows.map(r => ({
      id: r.id,
      symbol: r.symbol,
      price: r.price,
      action: r.action,
      confidence: r.confidence,
      dissentScore: r.dissentScore,
      swarmScore: r.swarmScore,
      bullAgents: r.bullAgents,
      bearAgents: r.bearAgents,
      holdAgents: r.holdAgents,
      synthesisReport: r.synthesisReport,
      durationMs: r.durationMs,
      runAt: r.runAt.toISOString(),
    })));
  } catch (err) {
    next(err);
  }
});

export default router;
