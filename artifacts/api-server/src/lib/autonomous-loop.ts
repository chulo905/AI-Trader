import { db, tradesTable, autonomousConfigTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getSingleQuote, getHistory } from "./tradersage";
import { computeIndicators, type OHLCVBar } from "./technicals";
import { checkRisk, enforceStopLosses } from "./risk-manager";
import { openai } from "@workspace/integrations-openai-ai-server";

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

function scoreDecision(rsi: number | null, macdHist: number | null, sma50Pct: number | null, changePercent: number): number {
  let score = 0;
  if (rsi !== null) score += rsi > 60 ? 2 : rsi < 40 ? -2 : 0;
  if (macdHist !== null) score += macdHist > 0 ? 2 : -2;
  if (sma50Pct !== null) score += sma50Pct > 0 ? 1 : -1;
  if (changePercent > 1.5) score += 1;
  if (changePercent < -1.5) score -= 1;
  return score;
}

async function runAIDecision(symbol: string, quote: { price: number; changePercent: number }, indicators: ReturnType<typeof computeIndicators>): Promise<string> {
  const prompt = `You are an AI trading advisor. For the stock ${symbol} at $${quote.price} (${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%), RSI ${indicators.rsi14 ?? "N/A"}, MACD ${indicators.macd?.histogram?.toFixed(3) ?? "N/A"}, above 50d SMA: ${indicators.priceVsSma50 !== null ? (indicators.priceVsSma50 > 0 ? "yes" : "no") : "unknown"}. Return ONLY JSON: {"action": "BUY"|"HOLD"|"SELL", "reason": "<one sentence>"}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-nano",
      max_completion_tokens: 100,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    return parsed.action ?? fallbackAction(indicators, quote.changePercent);
  } catch {
    return fallbackAction(indicators, quote.changePercent);
  }
}

function fallbackAction(indicators: ReturnType<typeof computeIndicators>, changePercent: number): string {
  const score = scoreDecision(indicators.rsi14, indicators.macd?.histogram ?? null, indicators.priceVsSma50, changePercent);
  if (score >= 3) return "BUY";
  if (score <= -3) return "SELL";
  return "HOLD";
}

async function processSymbol(config: typeof autonomousConfigTable.$inferSelect) {
  const { symbol, budgetPerTrade, maxShares } = config;
  const ts = new Date().toISOString();

  try {
    const [quote, history] = await Promise.all([
      getSingleQuote(symbol),
      getHistory(symbol, "1d", "3M"),
    ]);

    const bars: OHLCVBar[] = history.map(h => ({
      time: h.time, open: h.open, high: h.high, low: h.low, close: h.close, volume: h.volume,
    }));
    const indicators = computeIndicators(bars);
    const score = scoreDecision(indicators.rsi14, indicators.macd?.histogram ?? null, indicators.priceVsSma50, quote.changePercent);
    const rawAction = score >= 3 ? "BUY" : score <= -3 ? "SELL" : "HOLD";
    const currentPrices: Record<string, number> = { [symbol]: quote.price };

    await enforceStopLosses(currentPrices);

    if (rawAction === "HOLD") {
      const reason = `Score ${score}: indicators neutral, holding position.`;
      addLog({ ts, symbol, action: "HOLD", result: "No trade", reason });
      await db.update(autonomousConfigTable)
        .set({ lastRunAt: new Date(), lastAction: "HOLD", lastReason: reason, updatedAt: new Date() })
        .where(eq(autonomousConfigTable.id, config.id));
      return;
    }

    if (rawAction === "BUY") {
      const shares = Math.min(maxShares, Math.max(1, Math.floor(budgetPerTrade / quote.price)));
      const risk = await checkRisk("BUY", symbol, shares, quote.price, currentPrices);

      if (!risk.allowed) {
        addLog({ ts, symbol, action: "BUY (blocked)", result: "Risk blocked", reason: risk.reason ?? "Risk limit" });
        await db.update(autonomousConfigTable)
          .set({ lastRunAt: new Date(), lastAction: "RISK BLOCKED", lastReason: risk.reason ?? "Risk limit", updatedAt: new Date() })
          .where(eq(autonomousConfigTable.id, config.id));
        return;
      }

      const atr = indicators.atr14 ?? quote.price * 0.015;
      const [trade] = await db.insert(tradesTable).values({
        symbol,
        side: "long",
        shares,
        entryPrice: quote.price,
        stopLoss: Math.round((quote.price - atr * 1.5) * 100) / 100,
        takeProfit: Math.round((quote.price + atr * 3) * 100) / 100,
        notes: `Autonomous Loop: BUY (score ${score})`,
        status: "open",
      }).returning();

      const reason = `Score ${score}: bought ${shares} shares at $${quote.price}`;
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
          notes: `Autonomous Loop: SELL (score ${score})`,
        }).where(eq(tradesTable.id, t.id));
        closed++;
      }

      const reason = closed > 0
        ? `Score ${score}: closed ${closed} position(s) at $${quote.price}`
        : `Score ${score}: SELL signal but no open positions`;

      addLog({ ts, symbol, action: "SELL", result: closed > 0 ? `Closed ${closed}` : "No positions", reason });
      await db.update(autonomousConfigTable)
        .set({ lastRunAt: new Date(), lastAction: "SELL", lastReason: reason, totalAutoTrades: config.totalAutoTrades + closed, updatedAt: new Date() })
        .where(eq(autonomousConfigTable.id, config.id));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    addLog({ ts, symbol, action: "ERROR", result: "Failed", reason: msg });
    console.error(`[AutoLoop] Error processing ${symbol}:`, err);
  }
}

async function runLoop() {
  console.log("[AutoLoop] Running autonomous loop tick...");
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
    console.error("[AutoLoop] Loop error:", err);
  }
}

export function startAutonomousLoop() {
  if (loopTimer) return;
  console.log("[AutoLoop] Starting autonomous execution loop");
  runLoop();
  loopTimer = setInterval(runLoop, LOOP_INTERVAL_MS);
}

export function stopAutonomousLoop() {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
    console.log("[AutoLoop] Autonomous loop stopped");
  }
}

export function isLoopRunning() {
  return loopTimer !== null;
}
