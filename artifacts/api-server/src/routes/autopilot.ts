import { Router, type IRouter } from "express";
import { db, tradesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getSingleQuote, getHistory } from "../lib/tradersage";
import { computeIndicators, type OHLCVBar } from "../lib/technicals";
import { computeExtendedIndicators, type ExtendedIndicators } from "../lib/indicators-extended";
import { analyzePatterns } from "../lib/patterns";
import { detectMarketRegime } from "../lib/market-regime";
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
  indicators: ReturnType<typeof computeIndicators>,
  extended: ExtendedIndicators,
  bars: OHLCVBar[]
) {
  const patterns = analyzePatterns(bars, indicators.rsiSeries);
  const regime = detectMarketRegime(bars, symbol);

  const atr = indicators.atr14 ?? quote.price * 0.02;
  const portfolioEquity = 10000;
  const riskPct = 0.02;
  const riskDollars = portfolioEquity * riskPct;
  const riskPerShare = atr * 1.5;
  const kellyShares = Math.max(1, Math.round(riskDollars / riskPerShare));

  const detectedPatternsText = patterns.patterns.length > 0
    ? patterns.patterns.map(p => `  • ${p.type.replace(/-/g, " ").toUpperCase()} (${p.direction}, ${p.confidence}% confidence): ${p.description}`).join("\n")
    : "  • No high-confidence chart patterns detected";

  const divergenceText = patterns.divergence.description
    ? `${patterns.divergence.strength?.toUpperCase()} ${patterns.divergence.type?.toUpperCase()} DIVERGENCE: ${patterns.divergence.description}`
    : "No RSI divergence detected";

  const maSignalText = indicators.maSignal === "golden-cross"
    ? "⚡ GOLDEN CROSS: SMA50 crossed ABOVE SMA200 — major institutional bullish signal"
    : indicators.maSignal === "death-cross"
    ? "⚡ DEATH CROSS: SMA50 crossed BELOW SMA200 — major institutional bearish signal"
    : "No recent SMA crossover event";

  const ichimokuText = extended.ichimoku
    ? `Price is ${extended.ichimoku.aboveCloud ? "ABOVE" : "BELOW"} Ichimoku cloud ($${extended.ichimoku.cloudBottom}–$${extended.ichimoku.cloudTop}). Tenkan: $${extended.ichimoku.tenkan} / Kijun: $${extended.ichimoku.kijun}. ${extended.ichimoku.aboveCloud ? "Bullish cloud stance." : "Bearish cloud stance."}`
    : "N/A";

  const adxText = extended.adx
    ? `ADX(14): ${extended.adx.adx} (${extended.adx.trendStrength}) | +DI: ${extended.adx.pdi} | -DI: ${extended.adx.mdi}. ${extended.adx.adx > 25 ? "Strong directional trend present." : "Weak/no trend — be cautious with momentum plays."}`
    : "N/A";

  const prompt = `You are TradeSage, a world-class quantitative trading analyst with 20 years of experience in technical analysis, risk management, and behavioral finance. You are analyzing ${symbol} for a paper trading student who wants to learn professional trading.

Your task: Synthesize ALL data below into a single, precise trading decision. Think through 8 steps in sequence before deciding.

══════════════════════════════════════════════════════════
MARKET DATA
══════════════════════════════════════════════════════════
Symbol: ${symbol}
Price: $${quote.price}
Today's Change: ${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%
ATR(14): $${atr.toFixed(2)} (${(atr / quote.price * 100).toFixed(2)}% daily volatility)
52W High: $${indicators.highOf52w ?? "N/A"} (${indicators.pctFromHigh !== null ? indicators.pctFromHigh + "%" : "N/A"} from current)
52W Low: $${indicators.lowOf52w ?? "N/A"}

══════════════════════════════════════════════════════════
STEP 1 — MARKET REGIME (${regime.label})
══════════════════════════════════════════════════════════
Regime: ${regime.regime.toUpperCase()} | Score: ${regime.score} | Color: ${regime.color}
Description: ${regime.description}
Recommended strategy: ${regime.recommendedStrategy}

══════════════════════════════════════════════════════════
STEP 2 — TREND STRUCTURE
══════════════════════════════════════════════════════════
SMA20: $${indicators.sma20 ?? "N/A"} (${indicators.priceVsSma20 !== null ? (indicators.priceVsSma20 >= 0 ? "+" : "") + indicators.priceVsSma20 + "%" : "N/A"} from price)
SMA50: $${indicators.sma50 ?? "N/A"} (${indicators.priceVsSma50 !== null ? (indicators.priceVsSma50 >= 0 ? "+" : "") + indicators.priceVsSma50 + "%" : "N/A"} from price)
SMA200: $${indicators.sma200 ?? "N/A"} (${indicators.priceVsSma200 !== null ? (indicators.priceVsSma200 >= 0 ? "+" : "") + indicators.priceVsSma200 + "%" : "N/A"} from price)
EMA9: $${indicators.ema9 ?? "N/A"} | EMA21: $${indicators.ema21 ?? "N/A"}
${maSignalText}
Ichimoku: ${ichimokuText}
Parabolic SAR: $${extended.parabolicSAR ?? "N/A"} — price is ${extended.parabolicSAR !== null ? (quote.price > extended.parabolicSAR ? "ABOVE SAR (uptrend)" : "BELOW SAR (downtrend)") : "N/A"}

══════════════════════════════════════════════════════════
STEP 3 — MOMENTUM ANALYSIS
══════════════════════════════════════════════════════════
RSI(14): ${indicators.rsi14 ?? "N/A"} | RSI series (last 5): [${indicators.rsiSeries.slice(-5).join(", ")}]
MACD: ${indicators.macd ? `${indicators.macd.macd.toFixed(3)} / Signal: ${indicators.macd.signal.toFixed(3)} / Histogram: ${indicators.macd.histogram.toFixed(3)}` : "N/A"}
Stochastic %K: ${extended.stochastic?.k ?? "N/A"} / %D: ${extended.stochastic?.d ?? "N/A"}
Williams %R: ${extended.williamsR ?? "N/A"} (>-20 overbought, <-80 oversold)
CCI(20): ${extended.cci ?? "N/A"} (>100 overbought, <-100 oversold)
Aroon: Up ${extended.aroon?.aroonUp ?? "N/A"} / Down ${extended.aroon?.aroonDown ?? "N/A"} | Oscillator: ${extended.aroon?.aroonOscillator ?? "N/A"} | Trend: ${extended.aroon?.trend ?? "N/A"}
${adxText}

══════════════════════════════════════════════════════════
STEP 4 — VOLUME & SMART MONEY
══════════════════════════════════════════════════════════
Volume ratio vs avg: ${indicators.volumeRatio ?? "N/A"}x ${indicators.volumeSpike ? "— ⚡ VOLUME SPIKE (institutional activity)" : "— normal"}
OBV trend: ${extended.obvTrend ?? "N/A"} (rising OBV = accumulation; falling = distribution)

══════════════════════════════════════════════════════════
STEP 5 — CHART PATTERNS & DIVERGENCE
══════════════════════════════════════════════════════════
${detectedPatternsText}

RSI Divergence: ${divergenceText}
Pattern confluence: ${patterns.confluence.bullishCount} bullish signals vs ${patterns.confluence.bearishCount} bearish signals → ${patterns.confluence.dominantBias.toUpperCase()} bias

══════════════════════════════════════════════════════════
STEP 6 — KEY LEVELS
══════════════════════════════════════════════════════════
Bollinger Bands: Upper $${indicators.bollingerBands?.upper ?? "N/A"} / Middle $${indicators.bollingerBands?.middle ?? "N/A"} / Lower $${indicators.bollingerBands?.lower ?? "N/A"} (BW: ${indicators.bollingerBands?.bandwidth ?? "N/A"}%)
Nearest Support: ${patterns.levels.nearestSupport ? `$${patterns.levels.nearestSupport}` : "Not identified"}
Nearest Resistance: ${patterns.levels.nearestResistance ? `$${patterns.levels.nearestResistance}` : "Not identified"}
Pivot: ${patterns.levels.pivotPoint ? `$${patterns.levels.pivotPoint}` : "N/A"} | R1: $${patterns.levels.r1 ?? "N/A"} | R2: $${patterns.levels.r2 ?? "N/A"} | S1: $${patterns.levels.s1 ?? "N/A"} | S2: $${patterns.levels.s2 ?? "N/A"}

══════════════════════════════════════════════════════════
STEP 7 — SETUP QUALITY GRADING RUBRIC
══════════════════════════════════════════════════════════
Grade A+: 5+ indicators aligned, clear pattern, near key level, strong volume confirmation
Grade A:  4+ indicators aligned, defined risk/reward >2.5:1
Grade B:  3 indicators aligned, moderate confluence, R/R >2:1
Grade C:  Mixed signals, 2 indicators aligned, marginal setup
Grade D:  Conflicting indicators, poor timing, unclear trend
Grade F:  Counter-trend, no confirmation, high risk

══════════════════════════════════════════════════════════
STEP 8 — POSITION SIZING FRAMEWORK (Kelly-adjusted)
══════════════════════════════════════════════════════════
Portfolio equity: $${portfolioEquity}
Risk per trade (2%): $${riskDollars}
ATR-based risk per share: $${riskPerShare.toFixed(2)} (1.5× ATR)
Kelly-suggested shares: ${kellyShares} shares

══════════════════════════════════════════════════════════
DECISION FRAMEWORK
══════════════════════════════════════════════════════════
STRONG BUY: 5+ bullish signals, grade A/A+, regime bull/strong-bull
BUY: 3-4 bullish signals, grade B+, regime neutral or better
HOLD: Mixed signals, grade C or below, or near major resistance
SELL: 3-4 bearish signals, grade D or below, or trend breakdown
STRONG SELL: 5+ bearish signals, grade F, regime bear/strong-bear

Explain your reasoning in plain English that a beginner can understand. Never say "RSI", "MACD", "Bollinger", "Stochastic" — translate every indicator to plain language.

Return ONLY valid JSON:
{
  "action": "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL",
  "confidence": <integer 30-95>,
  "grade": "A+" | "A" | "B" | "C" | "D" | "F",
  "regime": "${regime.regime}",
  "regimeLabel": "${regime.label}",
  "headline": "<one bold, specific sentence: the AI's verdict and the single strongest reason — written like a Bloomberg headline>",
  "reasoning": "<4-5 sentences. Walk through the logic: market environment → trend direction → momentum quality → pattern signal → final verdict. Plain English, cite actual prices and percentages, no jargon.>",
  "bullCase": "<2-3 sentences. The strongest argument FOR buying right now. What must be true for bulls to win? What would trigger a big move up?>",
  "bearCase": "<2-3 sentences. The strongest argument AGAINST buying / for selling. What's the key risk? What would trigger a breakdown?>",
  "invalidationLevel": <number: the exact price that, if broken, proves this trade wrong. For longs: the support level or stop. For shorts: the resistance.>,
  "catalysts": ["<specific thing #1 that could move the stock this week>", "<specific thing #2>", "<specific thing #3>"],
  "timeInTrade": "<expected holding period in plain English, e.g. '3-7 trading days', '2-4 weeks', 'intraday'>",
  "whatHappensNext": "<1-2 sentences: what the AI specifically expects the price to do next and why>",
  "riskNote": "<1 sentence: the single biggest risk to this specific trade setup right now>",
  "suggestedShares": ${kellyShares},
  "stopLoss": <price: 1.5× ATR below entry for longs, above for shorts. Round to 2 decimal places.>,
  "takeProfit": <price: nearest resistance or 3× ATR above entry. Round to 2 decimal places.>,
  "riskReward": <decimal: (takeProfit - entry) / (entry - stopLoss), rounded to 1 decimal>
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    const result = {
      symbol,
      price: quote.price,
      change: quote.changePercent,
      action: parsed.action ?? "HOLD",
      confidence: parsed.confidence ?? 50,
      grade: parsed.grade ?? "C",
      regime: parsed.regime ?? regime.regime,
      regimeLabel: parsed.regimeLabel ?? regime.label,
      headline: parsed.headline ?? `AI is analyzing ${symbol}...`,
      reasoning: parsed.reasoning ?? "Analysis in progress. Please wait.",
      bullCase: parsed.bullCase ?? null,
      bearCase: parsed.bearCase ?? null,
      invalidationLevel: parsed.invalidationLevel ?? null,
      catalysts: Array.isArray(parsed.catalysts) ? parsed.catalysts : [],
      timeInTrade: parsed.timeInTrade ?? null,
      whatHappensNext: parsed.whatHappensNext ?? "",
      riskNote: parsed.riskNote ?? "",
      suggestedShares: parsed.suggestedShares ?? kellyShares,
      stopLoss: parsed.stopLoss ?? Math.round((quote.price - atr * 1.5) * 100) / 100,
      takeProfit: parsed.takeProfit ?? Math.round((quote.price + atr * 3) * 100) / 100,
      riskReward: parsed.riskReward ?? 2.0,
      indicators,
      extended,
      aiPowered: true,
      generatedAt: new Date().toISOString(),
    };

    decisionCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    logger.info({ symbol, action: parsed.action, grade: parsed.grade, regime: parsed.regime }, "Autopilot GPT decision cached");
  } catch (err) {
    logger.error({ symbol, err }, "Autopilot GPT decision failed");
    decisionCache.delete(cacheKey);
  } finally {
    pendingDecisions.delete(cacheKey);
  }
}

function buildFallbackDecision(
  symbol: string,
  quote: { price: number; changePercent: number },
  indicators: ReturnType<typeof computeIndicators>,
  extended: ExtendedIndicators,
  bars: OHLCVBar[]
) {
  const rsi = indicators.rsi14;
  const macdBull = indicators.macd ? indicators.macd.histogram > 0 : null;
  const aboveSma50 = indicators.priceVsSma50 !== null ? indicators.priceVsSma50 > 0 : null;
  const atr = indicators.atr14 ?? quote.price * 0.02;
  const regime = detectMarketRegime(bars, symbol);

  const portfolioEquity = 10000;
  const riskDollars = portfolioEquity * 0.02;
  const riskPerShare = atr * 1.5;
  const kellyShares = Math.max(1, Math.round(riskDollars / riskPerShare));

  let score = 0;
  if (rsi !== null) score += rsi > 60 ? 2 : rsi < 40 ? -2 : 0;
  if (macdBull === true) score += 2;
  if (macdBull === false) score -= 2;
  if (aboveSma50 === true) score += 1;
  if (aboveSma50 === false) score -= 1;
  if (quote.changePercent > 1.5) score += 1;
  if (quote.changePercent < -1.5) score -= 1;
  if (regime.score > 3) score += 1;
  if (regime.score < -3) score -= 1;

  let action = "HOLD";
  if (score >= 4) action = "STRONG BUY";
  else if (score >= 2) action = "BUY";
  else if (score <= -4) action = "STRONG SELL";
  else if (score <= -2) action = "SELL";

  const confidence = Math.min(40 + Math.abs(score) * 7, 82);
  const grade = score >= 4 ? "A" : score >= 2 ? "B" : score <= -4 ? "A" : score <= -2 ? "B" : "C";

  return {
    symbol,
    price: quote.price,
    change: quote.changePercent,
    action,
    confidence: Math.round(confidence),
    grade,
    regime: regime.regime,
    regimeLabel: regime.label,
    headline: `Scanning ${symbol} — deep AI reasoning loading in ~30 seconds`,
    reasoning: `${symbol} is at $${quote.price} (${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}% today). The market is in a ${regime.label.toLowerCase()} environment. Quick scan: momentum is ${rsi !== null ? (rsi > 60 ? "strong" : rsi < 40 ? "weak" : "neutral") : "loading"}, trend is ${macdBull === true ? "pointing up" : macdBull === false ? "pointing down" : "being calculated"}. Full 8-step AI analysis will replace this in ~30 seconds.`,
    bullCase: null,
    bearCase: null,
    invalidationLevel: null,
    catalysts: [],
    timeInTrade: null,
    whatHappensNext: "AI is running deep 8-step analysis — refresh in ~30 seconds for the full decision with bull/bear case and catalysts.",
    riskNote: "This is a quick scan only. Full AI analysis with setup grade and invalidation level is loading.",
    suggestedShares: kellyShares,
    stopLoss: Math.round((quote.price - atr * 1.5) * 100) / 100,
    takeProfit: Math.round((quote.price + atr * 3) * 100) / 100,
    riskReward: 2.0,
    indicators,
    extended,
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
    const extended = await computeExtendedIndicators(bars);

    if (!pendingDecisions.has(cacheKey)) {
      pendingDecisions.add(cacheKey);
      runAIDecisionInBackground(symbol, cacheKey, quote, indicators, extended, bars);
    }

    res.json({ ...buildFallbackDecision(symbol, quote, indicators, extended, bars), isMock: quote.isMock || historyResult.isMock });
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
