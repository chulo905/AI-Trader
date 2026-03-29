import { db, tradesTable, autonomousConfigTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getSingleQuote, getHistory } from "./tradersage";
import { computeIndicators, type OHLCVBar } from "./technicals";
import { computeExtendedIndicators } from "./indicators-extended";
import { analyzePatterns, type PatternAnalysis } from "./patterns";
import { checkRisk, enforceStopLosses } from "./risk-manager";
import { openai } from "./openai-client";
import { logger } from "./logger";

const LOOP_INTERVAL_MS = 60 * 1000;
let loopTimer: ReturnType<typeof setInterval> | null = null;

type ExecutionLogEntry = {
  ts: string;
  symbol: string;
  action: string;
  result: string;
  reason: string;
};

const executionLog: ExecutionLogEntry[] = [];
const MAX_LOG = 50;

function addLog(entry: ExecutionLogEntry) {
  executionLog.unshift(entry);
  if (executionLog.length > MAX_LOG) executionLog.pop();
}

export function getExecutionLog(): ExecutionLogEntry[] {
  return executionLog;
}

interface ScoredDecision {
  score: number;
  signals: string[];
  buyThreshold: number;
  sellThreshold: number;
  regime: string;
  blockedByPattern: boolean;
  divergenceBoost: boolean;
}

function scoreDecision(
  indicators: ReturnType<typeof computeIndicators>,
  extended: ReturnType<typeof computeExtendedIndicators>,
  patterns: PatternAnalysis,
  changePercent: number
): ScoredDecision {
  let score = 0;
  const signals: string[] = [];

  const rsi = indicators.rsi14;
  const macdHist = indicators.macd?.histogram ?? null;
  const sma50Pct = indicators.priceVsSma50;
  const sma200Pct = indicators.priceVsSma200;

  // RSI: weight 2 (oversold bounce more important than just "positive")
  if (rsi !== null) {
    if (rsi <= 25) { score += 3; signals.push(`RSI ${rsi} — extreme oversold, high reversal probability`); }
    else if (rsi <= 35) { score += 2; signals.push(`RSI ${rsi} — oversold zone`); }
    else if (rsi >= 75) { score -= 3; signals.push(`RSI ${rsi} — extreme overbought, risk of reversal`); }
    else if (rsi >= 65) { score -= 2; signals.push(`RSI ${rsi} — overbought`); }
    else if (rsi >= 55) { score += 1; signals.push(`RSI ${rsi} — mild bullish momentum`); }
    else if (rsi <= 45) { score -= 1; signals.push(`RSI ${rsi} — mild bearish momentum`); }
  }

  // MACD histogram: weight 2, scale by strength
  if (macdHist !== null) {
    if (macdHist > 0.5) { score += 3; signals.push(`MACD hist +${macdHist.toFixed(3)} — strong bullish`); }
    else if (macdHist > 0) { score += 2; signals.push(`MACD hist +${macdHist.toFixed(3)} — bullish`); }
    else if (macdHist < -0.5) { score -= 3; signals.push(`MACD hist ${macdHist.toFixed(3)} — strong bearish`); }
    else { score -= 2; signals.push(`MACD hist ${macdHist.toFixed(3)} — bearish`); }
  }

  // SMA200: weight 2 (higher timeframe trend matters more)
  if (sma200Pct !== null) {
    if (sma200Pct > 2) { score += 2; signals.push(`Price ${sma200Pct.toFixed(1)}% above 200d SMA — uptrend`); }
    else if (sma200Pct > 0) { score += 1; signals.push(`Price above 200d SMA — mild uptrend`); }
    else if (sma200Pct < -5) { score -= 2; signals.push(`Price ${Math.abs(sma200Pct).toFixed(1)}% below 200d SMA — downtrend`); }
    else { score -= 1; signals.push(`Price below 200d SMA — cautious`); }
  }

  // SMA50: weight 1
  if (sma50Pct !== null) {
    score += sma50Pct > 0 ? 1 : -1;
  }

  // MA crossover events
  if (indicators.maSignal === "golden-cross") { score += 3; signals.push("GOLDEN CROSS — major institutional bullish signal"); }
  if (indicators.maSignal === "death-cross") { score -= 3; signals.push("DEATH CROSS — major institutional bearish signal"); }

  // Volume spike confirmation
  if (indicators.volumeSpike) {
    const direction = changePercent >= 0 ? 1 : -1;
    score += direction;
    signals.push(`Volume spike ${indicators.volumeRatio}x — high conviction ${changePercent >= 0 ? "buying" : "selling"}`);
  }

  // Ichimoku: weight 2
  if (extended.ichimoku) {
    if (extended.ichimoku.aboveCloud) { score += 2; signals.push("Above Ichimoku cloud — bullish"); }
    else { score -= 2; signals.push("Below Ichimoku cloud — bearish"); }
  }

  // ADX: directional indicator with strength multiplier
  if (extended.adx?.adx !== null && extended.adx?.adx !== undefined) {
    if (extended.adx.adx >= 30) {
      const bullishDI = (extended.adx.pdi ?? 0) > (extended.adx.mdi ?? 0);
      score += bullishDI ? 2 : -2;
      signals.push(`ADX ${extended.adx.adx} — strong ${bullishDI ? "bullish" : "bearish"} trend`);
    } else if (extended.adx.adx >= 20) {
      const bullishDI = (extended.adx.pdi ?? 0) > (extended.adx.mdi ?? 0);
      score += bullishDI ? 1 : -1;
    }
  }

  // Stochastic: weight 1
  if (extended.stochastic?.k !== null && extended.stochastic?.k !== undefined) {
    const k = extended.stochastic.k;
    const d = extended.stochastic.d ?? k;
    if (k <= 20 && k > d) { score += 2; signals.push(`Stochastic ${k.toFixed(0)} — oversold crossup`); }
    else if (k >= 80 && k < d) { score -= 2; signals.push(`Stochastic ${k.toFixed(0)} — overbought crossdown`); }
    else if (k <= 30) score += 1;
    else if (k >= 70) score -= 1;
  }

  // Williams %R: weight 1
  if (extended.williamsR !== null && extended.williamsR !== undefined) {
    const wr = extended.williamsR;
    if (wr <= -80) { score += 1; signals.push(`Williams %R ${wr} — oversold`); }
    else if (wr >= -20) { score -= 1; signals.push(`Williams %R ${wr} — overbought`); }
  }

  // OBV: weight 1
  if (extended.obvTrend) {
    if (extended.obvTrend === "rising") { score += 1; signals.push("OBV rising — accumulation"); }
    else if (extended.obvTrend === "falling") { score -= 1; signals.push("OBV falling — distribution"); }
  }

  // Pattern confluence: weight 3 (highest)
  if (patterns.confluence.bullishCount > 0) {
    score += Math.min(patterns.confluence.bullishCount * 2, 4);
    signals.push(`${patterns.confluence.bullishCount} bullish pattern(s): ${patterns.patterns.filter(p => p.direction === "bullish").map(p => p.type).join(", ")}`);
  }
  if (patterns.confluence.bearishCount > 0) {
    score -= Math.min(patterns.confluence.bearishCount * 2, 4);
    signals.push(`${patterns.confluence.bearishCount} bearish pattern(s): ${patterns.patterns.filter(p => p.direction === "bearish").map(p => p.type).join(", ")}`);
  }

  // RSI Divergence: weight 3 (overrides direction signals)
  let divergenceBoost = false;
  if (patterns.divergence.type === "bullish") {
    const boost = patterns.divergence.strength === "strong" ? 4 : 3;
    score += boost;
    divergenceBoost = true;
    signals.push(`BULLISH RSI divergence (${patterns.divergence.strength}) — high reversal signal`);
  } else if (patterns.divergence.type === "bearish") {
    const penalty = patterns.divergence.strength === "strong" ? -4 : -3;
    score += penalty;
    signals.push(`BEARISH RSI divergence (${patterns.divergence.strength}) — momentum failing`);
  }

  // Determine market regime and thresholds
  const inUptrend = (sma200Pct ?? 0) > 0 && (sma50Pct ?? 0) > 0;
  const inDowntrend = (sma200Pct ?? 0) < -3 && (sma50Pct ?? 0) < -3;
  let regime: string;
  let buyThreshold: number;
  let sellThreshold: number;

  if (inUptrend && score > 5) {
    regime = "strong-bull";
    buyThreshold = 4;
    sellThreshold = -6;
  } else if (inUptrend) {
    regime = "bull";
    buyThreshold = 4;
    sellThreshold = -4;
  } else if (inDowntrend && score < -3) {
    regime = "strong-bear";
    buyThreshold = 10;
    sellThreshold = -3;
  } else if (inDowntrend) {
    regime = "bear";
    buyThreshold = 7;
    sellThreshold = -3;
  } else {
    regime = "neutral";
    buyThreshold = 5;
    sellThreshold = -5;
  }

  // Block BUY if strong bearish pattern detected
  const hasBearishPattern = patterns.patterns.some(p => p.direction === "bearish" && p.confidence >= 75);
  const blockedByPattern = hasBearishPattern && !divergenceBoost;

  return { score, signals, buyThreshold, sellThreshold, regime, blockedByPattern, divergenceBoost };
}

async function runAIDecision(
  symbol: string,
  quote: { price: number; changePercent: number },
  indicators: ReturnType<typeof computeIndicators>,
  extended: ReturnType<typeof computeExtendedIndicators>,
  patterns: PatternAnalysis,
  scored: ScoredDecision
): Promise<{ action: string; reason: string }> {
  const topSignals = scored.signals.slice(0, 6).join("; ");
  const topPatterns = patterns.patterns.length > 0
    ? patterns.patterns.map(p => `${p.type} (${p.direction})`).join(", ")
    : "none";

  const prompt = `You are an expert algorithmic trader making a paper trading decision. Analyze all factors and return a single JSON decision.

STOCK: ${symbol}
PRICE: $${quote.price} | CHANGE: ${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%
MARKET REGIME: ${scored.regime}

KEY SIGNALS (quantitative scoring: ${scored.score > 0 ? "+" : ""}${scored.score}):
${topSignals}

CHART PATTERNS: ${topPatterns}
RSI DIVERGENCE: ${patterns.divergence.description ?? "none"}
MA CROSSOVER: ${indicators.maSignal !== "neutral" ? indicators.maSignal.toUpperCase() : "none"}
VOLUME: ${indicators.volumeSpike ? `SPIKE ${indicators.volumeRatio}x average` : `${indicators.volumeRatio ?? "N/A"}x average`}

RAW VALUES:
- RSI(14): ${indicators.rsi14 ?? "N/A"} | SMA200 pct: ${indicators.priceVsSma200 ?? "N/A"}% | SMA50 pct: ${indicators.priceVsSma50 ?? "N/A"}%
- MACD histogram: ${indicators.macd?.histogram?.toFixed(3) ?? "N/A"}
- ATR(14): $${indicators.atr14 ?? "N/A"} | Ichimoku: ${extended.ichimoku ? (extended.ichimoku.aboveCloud ? "above cloud" : "below cloud") : "N/A"}
- ADX: ${extended.adx?.adx ?? "N/A"} (${extended.adx?.trendStrength ?? "N/A"}) +DI:${extended.adx?.pdi ?? "N/A"} -DI:${extended.adx?.mdi ?? "N/A"}
- Stochastic: K=${extended.stochastic?.k ?? "N/A"} D=${extended.stochastic?.d ?? "N/A"}

RULES:
- Score ${scored.score} vs BUY threshold ${scored.buyThreshold} / SELL threshold ${scored.sellThreshold}
- Pattern block active: ${scored.blockedByPattern} (never BUY if true unless divergence overrides)
- Paper trading — capital preservation is priority. Require conviction to BUY.
- In bear regime: default to HOLD unless divergence or pattern reversal is exceptionally strong

Return ONLY JSON: {"action": "BUY"|"HOLD"|"SELL", "reason": "<one clear sentence with specific data points>"}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 150,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const action = ["BUY", "HOLD", "SELL"].includes(parsed.action) ? parsed.action : fallbackAction(scored);
    return { action, reason: parsed.reason ?? `Score ${scored.score}, regime ${scored.regime}` };
  } catch {
    const action = fallbackAction(scored);
    return { action, reason: `Score ${scored.score} (${scored.signals.slice(0, 3).join("; ")})` };
  }
}

function fallbackAction(scored: ScoredDecision): string {
  if (scored.blockedByPattern) return "HOLD";
  if (scored.score >= scored.buyThreshold) return "BUY";
  if (scored.score <= scored.sellThreshold) return "SELL";
  return "HOLD";
}

async function processSymbol(config: typeof autonomousConfigTable.$inferSelect) {
  const { symbol, budgetPerTrade, maxShares } = config;
  const ts = new Date().toISOString();

  try {
    const [quote, historyResult] = await Promise.all([
      getSingleQuote(symbol),
      getHistory(symbol, "1d", "3M"),
    ]);

    const bars: OHLCVBar[] = historyResult.candles.map(h => ({
      time: h.time, open: h.open, high: h.high, low: h.low, close: h.close, volume: h.volume,
    }));
    const indicators = computeIndicators(bars);
    const extended = computeExtendedIndicators(bars);
    const patterns = analyzePatterns(bars, indicators.rsiSeries);
    const scored = scoreDecision(indicators, extended, patterns, quote.changePercent);
    const currentPrices: Record<string, number> = { [symbol]: quote.price };

    await enforceStopLosses(currentPrices);

    const { action: rawAction, reason: aiReason } = await runAIDecision(symbol, quote, indicators, extended, patterns, scored);
    const { score } = scored;

    if (rawAction === "HOLD") {
      addLog({ ts, symbol, action: "HOLD", result: "No trade", reason: aiReason });
      await db.update(autonomousConfigTable)
        .set({ lastRunAt: new Date(), lastAction: "HOLD", lastReason: aiReason, updatedAt: new Date() })
        .where(eq(autonomousConfigTable.id, config.id));
      return;
    }

    if (rawAction === "BUY") {
      if (scored.blockedByPattern) {
        const reason = `BUY signal (score ${score}) blocked: bearish chart pattern detected`;
        addLog({ ts, symbol, action: "BUY (pattern-blocked)", result: "No trade", reason });
        await db.update(autonomousConfigTable)
          .set({ lastRunAt: new Date(), lastAction: "PATTERN BLOCKED", lastReason: reason, updatedAt: new Date() })
          .where(eq(autonomousConfigTable.id, config.id));
        return;
      }

      const shares = Math.min(maxShares, Math.max(1, Math.floor(budgetPerTrade / quote.price)));
      const risk = await checkRisk("BUY", symbol, shares, quote.price, currentPrices);

      if (!risk.allowed) {
        addLog({ ts, symbol, action: "BUY (risk-blocked)", result: "Risk blocked", reason: risk.reason ?? "Risk limit" });
        await db.update(autonomousConfigTable)
          .set({ lastRunAt: new Date(), lastAction: "RISK BLOCKED", lastReason: risk.reason ?? "Risk limit", updatedAt: new Date() })
          .where(eq(autonomousConfigTable.id, config.id));
        return;
      }

      const atr = indicators.atr14 ?? quote.price * 0.015;
      const stopLoss = Math.round((quote.price - atr * 1.5) * 100) / 100;
      const takeProfit = Math.round((quote.price + atr * 3) * 100) / 100;
      const rrRatio = ((takeProfit - quote.price) / (quote.price - stopLoss)).toFixed(2);

      const patternNote = patterns.patterns.length > 0 ? ` | Patterns: ${patterns.patterns.map(p => p.type).join(", ")}` : "";
      const divergenceNote = patterns.divergence.type ? ` | Divergence: ${patterns.divergence.type}` : "";

      const [trade] = await db.insert(tradesTable).values({
        symbol,
        side: "long",
        shares,
        entryPrice: quote.price,
        stopLoss,
        takeProfit,
        notes: `AutoLoop BUY | Score: ${score}/${scored.buyThreshold} | Regime: ${scored.regime} | R:R ${rrRatio}:1 | ATR-based stops${patternNote}${divergenceNote} | ${aiReason}`,
        status: "open",
      }).returning();

      const reason = `${aiReason} | ${shares} shares at $${quote.price} | Stop $${stopLoss} | Target $${takeProfit} | R:R ${rrRatio}:1`;
      addLog({ ts, symbol, action: "BUY", result: `Trade #${trade?.id}`, reason });
      await db.update(autonomousConfigTable)
        .set({ lastRunAt: new Date(), lastAction: "BUY", lastReason: reason, totalAutoTrades: config.totalAutoTrades + 1, updatedAt: new Date() })
        .where(eq(autonomousConfigTable.id, config.id));
    }

    if (rawAction === "SELL") {
      const openTrades = await db.select().from(tradesTable)
        .where(and(eq(tradesTable.status, "open"), eq(tradesTable.symbol, symbol)));

      let closed = 0;
      for (const t of openTrades) {
        const pnl = (quote.price - t.entryPrice) * t.shares;
        const pct = (pnl / (t.entryPrice * t.shares)) * 100;
        await db.update(tradesTable).set({
          exitPrice: quote.price,
          realizedPnl: Math.round(pnl * 100) / 100,
          realizedPnlPercent: Math.round(pct * 100) / 100,
          status: "closed",
          closedAt: new Date(),
          notes: `AutoLoop SELL | Score: ${score} | Regime: ${scored.regime} | ${aiReason}`,
        }).where(eq(tradesTable.id, t.id));
        closed++;
      }

      const reason = closed > 0
        ? `${aiReason} | Closed ${closed} position(s) at $${quote.price}`
        : `${aiReason} | SELL signal but no open positions to close`;

      addLog({ ts, symbol, action: "SELL", result: closed > 0 ? `Closed ${closed}` : "No positions", reason });
      await db.update(autonomousConfigTable)
        .set({ lastRunAt: new Date(), lastAction: "SELL", lastReason: reason, totalAutoTrades: config.totalAutoTrades + closed, updatedAt: new Date() })
        .where(eq(autonomousConfigTable.id, config.id));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    addLog({ ts, symbol, action: "ERROR", result: "Failed", reason: msg });
    logger.error({ symbol, err }, "AutoLoop error processing symbol");
  }
}

async function runLoop() {
  logger.debug("AutoLoop tick running");
  try {
    const configs = await db.select().from(autonomousConfigTable)
      .where(eq(autonomousConfigTable.enabled, true));

    for (const config of configs) {
      const intervalMs = config.intervalMinutes * 60 * 1000;
      const lastRun = config.lastRunAt ? new Date(config.lastRunAt).getTime() : 0;
      const timeSinceRun = Date.now() - lastRun;

      if (timeSinceRun >= intervalMs) {
        await processSymbol(config);
      }
    }
  } catch (err) {
    logger.error({ err }, "AutoLoop loop error");
  }
}

export function startAutonomousLoop() {
  if (loopTimer) return;
  logger.info("AutoLoop starting autonomous execution loop");
  runLoop();
  loopTimer = setInterval(runLoop, LOOP_INTERVAL_MS);
}

export function stopAutonomousLoop() {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
    logger.info("AutoLoop stopped");
  }
}

export function isLoopRunning() {
  return loopTimer !== null;
}
