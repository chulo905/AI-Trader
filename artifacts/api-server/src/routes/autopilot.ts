import { Router, type IRouter } from "express";
import { db, tradesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getSingleQuote, getHistory } from "../lib/tradersage";
import { computeIndicators, type OHLCVBar } from "../lib/technicals";
import { openai } from "../lib/openai-client";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const decisionCache = new Map<string, { data: object; expiresAt: number }>();
const pendingDecisions = new Set<string>();
const CACHE_TTL_MS = 3 * 60 * 1000;

async function runAIDecisionInBackground(
  symbol: string,
  cacheKey: string,
  quote: { price: number; changePercent: number; volume: number },
  indicators: ReturnType<typeof computeIndicators>
) {
  const prompt = `You are an expert AI trading advisor helping a beginner investor. Analyze this stock and give a clear, confident trading decision in plain, simple English (no jargon).

STOCK: ${symbol}
CURRENT PRICE: $${quote.price}
TODAY'S CHANGE: ${quote.changePercent > 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%

INDICATOR DATA (do not mention these by name to beginners — translate to plain English):
- Momentum Score (RSI 14): ${indicators.rsi14 ?? "N/A"} out of 100 (>70 = overheated, <30 = undervalued zone)
- Trend Strength (MACD histogram): ${indicators.macd?.histogram ?? "N/A"} (positive = uptrend, negative = downtrend)
- Price vs 50-day average: ${indicators.priceVsSma50 !== null ? (indicators.priceVsSma50 >= 0 ? "+" : "") + indicators.priceVsSma50 + "%" : "N/A"}
- Price vs 200-day average: ${indicators.priceVsSma200 !== null ? (indicators.priceVsSma200 >= 0 ? "+" : "") + indicators.priceVsSma200 + "%" : "N/A"}
- Volatility (ATR 14): $${indicators.atr14 ?? "N/A"}
- Volume vs Average: ${indicators.volumeRatio ?? "N/A"}x
- 52-Week High: $${indicators.highOf52w ?? "N/A"} (${indicators.pctFromHigh !== null ? indicators.pctFromHigh + "%" : "N/A"} away)
- 52-Week Low: $${indicators.lowOf52w ?? "N/A"}
- Price Band Upper: $${indicators.bollingerBands?.upper ?? "N/A"}
- Price Band Lower: $${indicators.bollingerBands?.lower ?? "N/A"}

Return ONLY a valid JSON object:
{
  "action": "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL",
  "confidence": <integer 30-95>,
  "headline": "<one bold sentence: what the AI decided and why, like a headline — beginner friendly>",
  "reasoning": "<3-4 sentences in plain English. Explain the stock's current situation, what the data shows, and why the AI made this decision. Use words like 'momentum', 'trend', 'value', 'pressure' — never say RSI, MACD, or Bollinger Bands.>",
  "whatHappensNext": "<1-2 sentences about what the AI expects to happen next with the stock price>",
  "riskNote": "<1 sentence about the biggest risk to this trade>",
  "suggestedShares": <integer, how many shares to buy with a $1,000 budget — round number>,
  "stopLoss": <price — where to cut losses, 1-1.5x ATR below current price>,
  "takeProfit": <price — realistic target price>,
  "riskReward": <ratio as a decimal, e.g. 2.3>
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    const atr = indicators.atr14 ?? quote.price * 0.02;

    const result = {
      symbol,
      price: quote.price,
      change: quote.changePercent,
      action: parsed.action ?? "HOLD",
      confidence: parsed.confidence ?? 50,
      headline: parsed.headline ?? `AI is analyzing ${symbol}...`,
      reasoning: parsed.reasoning ?? "Analysis in progress. Please wait.",
      whatHappensNext: parsed.whatHappensNext ?? "",
      riskNote: parsed.riskNote ?? "",
      suggestedShares: parsed.suggestedShares ?? Math.floor(1000 / quote.price),
      stopLoss: parsed.stopLoss ?? Math.round((quote.price - atr * 1.5) * 100) / 100,
      takeProfit: parsed.takeProfit ?? Math.round((quote.price + atr * 3) * 100) / 100,
      riskReward: parsed.riskReward ?? 2.0,
      indicators,
      aiPowered: true,
      generatedAt: new Date().toISOString(),
    };

    decisionCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    logger.info({ symbol, action: parsed.action }, "Autopilot GPT decision cached");
  } catch (err) {
    logger.error({ symbol, err }, "Autopilot GPT decision failed");
    decisionCache.delete(cacheKey);
  } finally {
    pendingDecisions.delete(cacheKey);
  }
}

function buildFallbackDecision(symbol: string, quote: { price: number; changePercent: number }, indicators: ReturnType<typeof computeIndicators>) {
  const rsi = indicators.rsi14;
  const macdBull = indicators.macd ? indicators.macd.histogram > 0 : null;
  const aboveSma50 = indicators.priceVsSma50 !== null ? indicators.priceVsSma50 > 0 : null;
  const atr = indicators.atr14 ?? quote.price * 0.02;

  let score = 0;
  if (rsi !== null) score += rsi > 60 ? 2 : rsi < 40 ? -2 : 0;
  if (macdBull === true) score += 2;
  if (macdBull === false) score -= 2;
  if (aboveSma50 === true) score += 1;
  if (aboveSma50 === false) score -= 1;
  if (quote.changePercent > 1.5) score += 1;
  if (quote.changePercent < -1.5) score -= 1;

  let action = "HOLD";
  if (score >= 4) action = "STRONG BUY";
  else if (score >= 2) action = "BUY";
  else if (score <= -4) action = "STRONG SELL";
  else if (score <= -2) action = "SELL";

  const confidence = Math.min(40 + Math.abs(score) * 7, 82);

  return {
    symbol,
    price: quote.price,
    change: quote.changePercent,
    action,
    confidence: Math.round(confidence),
    headline: `AI is analyzing ${symbol} — computing full decision now...`,
    reasoning: `${symbol} is currently at $${quote.price} (${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}% today). Quick scan: momentum is ${rsi !== null ? (rsi > 60 ? "strong" : rsi < 40 ? "weak" : "neutral") : "loading"}, trend is ${macdBull === true ? "pointing up" : macdBull === false ? "pointing down" : "being calculated"}. Full AI reasoning will be ready shortly.`,
    whatHappensNext: "AI is running deep analysis — refresh in ~30 seconds for the full decision.",
    riskNote: "Always remember this is paper trading — no real money is at risk.",
    suggestedShares: Math.max(1, Math.floor(1000 / quote.price)),
    stopLoss: Math.round((quote.price - atr * 1.5) * 100) / 100,
    takeProfit: Math.round((quote.price + atr * 3) * 100) / 100,
    riskReward: 2.0,
    indicators,
    aiPowered: false,
    generatedAt: new Date().toISOString(),
  };
}

router.get("/:symbol", async (req, res) => {
  const symbol = req.params["symbol"]!.toUpperCase();
  const cacheKey = symbol;

  const cached = decisionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.data);
    return;
  }

  try {
    const [quote, historyResult] = await Promise.all([
      getSingleQuote(symbol),
      getHistory(symbol, "1d", "3M"),
    ]);

    const bars: OHLCVBar[] = historyResult.candles.map(h => ({
      time: h.time, open: h.open, high: h.high, low: h.low, close: h.close, volume: h.volume,
    }));
    const indicators = computeIndicators(bars);

    if (!pendingDecisions.has(cacheKey)) {
      pendingDecisions.add(cacheKey);
      runAIDecisionInBackground(symbol, cacheKey, quote, indicators);
    }

    res.json({ ...buildFallbackDecision(symbol, quote, indicators), isMock: quote.isMock || historyResult.isMock });
  } catch (err) {
    logger.error({ symbol, err }, "Autopilot decision error");
    res.status(500).json({ error: "Failed to generate AI decision" });
  }
});

router.post("/:symbol/execute", async (req, res) => {
  const symbol = req.params["symbol"]!.toUpperCase();
  const { action, shares, entryPrice, stopLoss, takeProfit } = req.body;

  if (!action || !shares || !entryPrice) {
    res.status(400).json({ error: "action, shares, and entryPrice are required" });
    return;
  }

  try {
    if (action === "SELL" || action === "STRONG SELL") {
      const openTrades = await db.select().from(tradesTable)
        .where(eq(tradesTable.status, "open"));
      const symbolTrades = openTrades.filter(t => t.symbol === symbol && t.side === "long");

      const closed = [];
      for (const trade of symbolTrades) {
        const price = parseFloat(entryPrice);
        const realizedPnl = (price - trade.entryPrice) * trade.shares;
        const realizedPnlPercent = (realizedPnl / (trade.entryPrice * trade.shares)) * 100;
        const [updated] = await db.update(tradesTable).set({
          exitPrice: price,
          realizedPnl: Math.round(realizedPnl * 100) / 100,
          realizedPnlPercent: Math.round(realizedPnlPercent * 100) / 100,
          status: "closed",
          closedAt: new Date(),
          notes: `AI Autopilot: ${action}`,
        }).where(eq(tradesTable.id, trade.id)).returning();
        if (updated) closed.push(updated);
      }

      res.json({
        executed: true,
        action,
        symbol,
        closedTrades: closed.length,
        message: closed.length > 0
          ? `AI closed ${closed.length} position(s) in ${symbol}.`
          : `No open ${symbol} positions to close.`,
      });
      return;
    }

    const side = "long";
    const [trade] = await db.insert(tradesTable).values({
      symbol,
      side,
      shares: parseFloat(shares),
      entryPrice: parseFloat(entryPrice),
      stopLoss: stopLoss ? parseFloat(stopLoss) : null,
      takeProfit: takeProfit ? parseFloat(takeProfit) : null,
      notes: `AI Autopilot: ${action}`,
      status: "open",
    }).returning();

    res.status(201).json({
      executed: true,
      action,
      symbol,
      trade: { ...trade!, openedAt: trade!.openedAt.toISOString(), closedAt: null },
      message: `AI bought ${shares} shares of ${symbol} at $${entryPrice}.`,
    });
  } catch (err) {
    logger.error({ symbol, err }, "Autopilot execute error");
    res.status(500).json({ error: "Failed to execute AI trade" });
  }
});

export default router;
