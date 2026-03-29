import { openai } from "@workspace/integrations-openai-ai-server";
import { getHistory, getSingleQuote } from "./tradersage";
import { computeIndicators, interpretIndicators, type OHLCVBar } from "./technicals";
import { computeExtendedIndicators, interpretExtendedIndicators } from "./indicators-extended";
import { logger } from "./logger";

const analysisCache = new Map<string, { data: object; expiresAt: number }>();
const pendingAnalysis = new Set<string>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function generateAnalysis(symbol: string, timeframe: string) {
  const cacheKey = `${symbol}:${timeframe}`;
  const cached = analysisCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const [quote, historyResult] = await Promise.all([
    getSingleQuote(symbol),
    getHistory(symbol, timeframe, "3M"),
  ]);

  const bars: OHLCVBar[] = historyResult.candles.map(h => ({
    time: h.time, open: h.open, high: h.high, low: h.low, close: h.close, volume: h.volume,
  }));
  const indicators = computeIndicators(bars);
  const extended = computeExtendedIndicators(bars);

  if (!pendingAnalysis.has(cacheKey)) {
    pendingAnalysis.add(cacheKey);
    runLLMInBackground(symbol, timeframe, cacheKey, quote, indicators, extended);
  }

  return { ...buildFallbackAnalysis(symbol, timeframe, quote, indicators, extended), isMock: quote.isMock || historyResult.isMock };
}

async function runLLMInBackground(
  symbol: string,
  timeframe: string,
  cacheKey: string,
  quote: { price: number; changePercent: number },
  indicators: ReturnType<typeof computeIndicators>,
  extended: ReturnType<typeof computeExtendedIndicators>
) {
  const indicatorSummary = interpretIndicators(indicators, quote.price);
  const extendedSummary = interpretExtendedIndicators(extended, quote.price);

  const prompt = `You are a professional quantitative analyst generating a technical analysis report for a trading terminal. Analyze the following data and return a structured JSON object.

SYMBOL: ${symbol}
CURRENT PRICE: $${quote.price}
TODAY'S CHANGE: ${quote.changePercent > 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%
TIMEFRAME: ${timeframe}

TECHNICAL INDICATORS (computed from real OHLCV data):
${indicatorSummary}

EXTENDED INDICATORS:
${extendedSummary || "Insufficient data for extended indicators"}

RAW INDICATOR VALUES:
- RSI(14): ${indicators.rsi14 ?? "insufficient data"}
- SMA20: $${indicators.sma20 ?? "N/A"} (price ${indicators.priceVsSma20 !== null ? (indicators.priceVsSma20 >= 0 ? "+" : "") + indicators.priceVsSma20 + "%" : "N/A"} vs SMA20)
- SMA50: $${indicators.sma50 ?? "N/A"} (price ${indicators.priceVsSma50 !== null ? (indicators.priceVsSma50 >= 0 ? "+" : "") + indicators.priceVsSma50 + "%" : "N/A"} vs SMA50)
- SMA200: $${indicators.sma200 ?? "N/A"} (price ${indicators.priceVsSma200 !== null ? (indicators.priceVsSma200 >= 0 ? "+" : "") + indicators.priceVsSma200 + "%" : "N/A"} vs SMA200)
- EMA9: $${indicators.ema9 ?? "N/A"}, EMA21: $${indicators.ema21 ?? "N/A"}
- MACD: ${indicators.macd ? `${indicators.macd.macd} / Signal: ${indicators.macd.signal} / Histogram: ${indicators.macd.histogram}` : "N/A"}
- Bollinger Bands: ${indicators.bollingerBands ? `Upper $${indicators.bollingerBands.upper} / Middle $${indicators.bollingerBands.middle} / Lower $${indicators.bollingerBands.lower} / BW: ${indicators.bollingerBands.bandwidth}%` : "N/A"}
- ATR(14): ${indicators.atr14 ?? "N/A"}
- Volume Ratio (5d vs 15d): ${indicators.volumeRatio ?? "N/A"}x
- 52W High: $${indicators.highOf52w ?? "N/A"} (${indicators.pctFromHigh !== null ? indicators.pctFromHigh + "%" : "N/A"} from high)
- 52W Low: $${indicators.lowOf52w ?? "N/A"}
- Stochastic %K: ${extended.stochastic?.k ?? "N/A"} / %D: ${extended.stochastic?.d ?? "N/A"}
- Williams %R(14): ${extended.williamsR ?? "N/A"}
- CCI(20): ${extended.cci ?? "N/A"}
- Parabolic SAR: $${extended.parabolicSAR ?? "N/A"} (price ${extended.parabolicSAR !== null ? (quote.price > extended.parabolicSAR ? "above SAR — uptrend" : "below SAR — downtrend") : "N/A"})
- ADX(14): ${extended.adx?.adx ?? "N/A"} (${extended.adx?.trendStrength ?? "N/A"} trend) +DI: ${extended.adx?.pdi ?? "N/A"} / -DI: ${extended.adx?.mdi ?? "N/A"}
- OBV: ${extended.obv ?? "N/A"} (${extended.obvTrend ?? "N/A"})
- Ichimoku Cloud: ${extended.ichimoku ? `${extended.ichimoku.aboveCloud ? "above" : "below"} cloud ($${extended.ichimoku.cloudBottom}–$${extended.ichimoku.cloudTop}), Tenkan $${extended.ichimoku.tenkan}, Kijun $${extended.ichimoku.kijun}` : "N/A"}

Return ONLY a valid JSON object with this exact structure:
{
  "bias": "bullish" | "bearish" | "neutral",
  "confidence": <integer 30-90>,
  "summary": "<2-3 sentence expert analysis citing specific values. Be precise and actionable.>",
  "trend": "<1-2 sentences about trend structure using SMA relationships>",
  "momentum": "<1 sentence about RSI and MACD momentum>",
  "volatility": "<1 sentence about Bollinger Bands bandwidth and position sizing>",
  "keyLevels": [
    { "type": "resistance", "price": <number>, "description": "<why this level matters>" },
    { "type": "resistance", "price": <number>, "description": "<why this level matters>" },
    { "type": "support", "price": <number>, "description": "<why this level matters>" },
    { "type": "support", "price": <number>, "description": "<why this level matters>" }
  ],
  "signals": [
    { "name": "RSI (14)", "value": "<value>", "interpretation": "<Overbought|Oversold|Bullish|Bearish|Neutral>" },
    { "name": "MACD", "value": "<macd> / <signal>", "interpretation": "<Bullish|Bearish|Neutral>" },
    { "name": "SMA Trend", "value": "<price vs SMA50>", "interpretation": "<Bullish|Bearish|Neutral>" },
    { "name": "Bollinger Bands", "value": "<position>", "interpretation": "<Overbought|Oversold|Squeeze|Normal>" },
    { "name": "Volume", "value": "<ratio>x avg", "interpretation": "<High Conviction|Low Conviction|Normal>" }
  ]
}

Derive key levels from Bollinger Bands, SMAs, and 52-week range. Paper trading only — not financial advice.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    const result = {
      symbol,
      timeframe,
      bias: parsed.bias ?? "neutral",
      confidence: parsed.confidence ?? 50,
      summary: parsed.summary ?? "Analysis unavailable.",
      trend: parsed.trend ?? "",
      momentum: parsed.momentum ?? "",
      volatility: parsed.volatility ?? "",
      keyLevels: parsed.keyLevels ?? buildFallbackLevels(indicators, quote.price),
      signals: parsed.signals ?? buildFallbackSignals(indicators, quote.changePercent),
      indicators,
      extended,
      generatedAt: new Date().toISOString(),
      aiPowered: true,
    };
    analysisCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    logger.info({ cacheKey }, "GPT analysis cached");
  } catch (err) {
    logger.error({ err }, "LLM analysis background task failed");
    analysisCache.delete(cacheKey);
  } finally {
    pendingAnalysis.delete(cacheKey);
  }
}

function buildFallbackLevels(indicators: ReturnType<typeof computeIndicators>, price: number) {
  const levels = [];
  if (indicators.bollingerBands) {
    levels.push({ type: "resistance", price: indicators.bollingerBands.upper, description: "Upper Bollinger Band — mean reversion zone" });
    levels.push({ type: "support", price: indicators.bollingerBands.lower, description: "Lower Bollinger Band — mean reversion support" });
  }
  if (indicators.sma50) levels.push({ type: "support", price: indicators.sma50, description: "50-day SMA — key institutional support/resistance" });
  if (indicators.sma200) levels.push({ type: "support", price: indicators.sma200, description: "200-day SMA — primary trend line" });
  if (levels.length === 0) {
    levels.push({ type: "resistance", price: Math.round(price * 1.03 * 100) / 100, description: "Near-term resistance zone" });
    levels.push({ type: "support", price: Math.round(price * 0.97 * 100) / 100, description: "Near-term support zone" });
  }
  return levels;
}

function buildFallbackSignals(indicators: ReturnType<typeof computeIndicators>, changePercent: number) {
  const rsi = indicators.rsi14;
  return [
    { name: "RSI (14)", value: rsi?.toFixed(1) ?? "N/A", interpretation: rsi === null ? "N/A" : rsi > 70 ? "Overbought" : rsi < 30 ? "Oversold" : rsi > 55 ? "Bullish" : rsi < 45 ? "Bearish" : "Neutral" },
    { name: "MACD", value: indicators.macd ? `${indicators.macd.macd}` : "N/A", interpretation: indicators.macd ? (indicators.macd.histogram > 0 ? "Bullish" : "Bearish") : "N/A" },
    { name: "SMA Trend", value: indicators.priceVsSma50 !== null ? `${indicators.priceVsSma50 >= 0 ? "+" : ""}${indicators.priceVsSma50}% vs SMA50` : "N/A", interpretation: indicators.priceVsSma50 !== null ? (indicators.priceVsSma50 > 0 ? "Bullish" : "Bearish") : "N/A" },
    { name: "Bollinger Bands", value: indicators.bollingerBands ? `BW ${indicators.bollingerBands.bandwidth}%` : "N/A", interpretation: indicators.bollingerBands ? (indicators.bollingerBands.bandwidth < 5 ? "Squeeze" : "Normal") : "N/A" },
    { name: "Volume", value: indicators.volumeRatio ? `${indicators.volumeRatio}x avg` : "N/A", interpretation: indicators.volumeRatio ? (indicators.volumeRatio > 1.5 ? "High Conviction" : indicators.volumeRatio < 0.7 ? "Low Conviction" : "Normal") : "N/A" },
  ];
}

function buildFallbackAnalysis(symbol: string, timeframe: string, quote: { price: number; changePercent: number }, indicators: ReturnType<typeof computeIndicators>, extended: ReturnType<typeof computeExtendedIndicators>) {
  const rsi = indicators.rsi14;
  const bias = rsi !== null ? (rsi > 60 ? "bullish" : rsi < 40 ? "bearish" : "neutral") : "neutral";
  const confidence = rsi !== null ? Math.min(40 + Math.abs(rsi - 50), 88) : 50;

  return {
    symbol,
    timeframe,
    bias,
    confidence: Math.round(confidence),
    summary: `${symbol} at $${quote.price} (${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}% today). RSI(14) at ${rsi?.toFixed(1) ?? "N/A"} — ${rsi !== null ? (rsi > 70 ? "overbought territory" : rsi < 30 ? "oversold territory" : "neutral momentum zone") : "insufficient data"}. ${indicators.sma50 ? `Price is ${Math.abs(indicators.priceVsSma50!).toFixed(1)}% ${indicators.priceVsSma50! >= 0 ? "above" : "below"} the 50-day SMA.` : ""} AI-enhanced analysis loading in background — refresh in ~30s for GPT insights.`,
    trend: indicators.priceVsSma50 !== null ? `Price is ${Math.abs(indicators.priceVsSma50).toFixed(1)}% ${indicators.priceVsSma50 >= 0 ? "above" : "below"} the 50-day SMA (${indicators.sma50}). ${indicators.sma20 && indicators.sma50 ? (indicators.sma20 > indicators.sma50 ? "SMA20 above SMA50 — short-term trend is bullish." : "SMA20 below SMA50 — short-term trend is bearish.") : ""}` : "Insufficient data for trend analysis.",
    momentum: rsi !== null ? `RSI(14) at ${rsi.toFixed(1)} — ${rsi > 70 ? "overbought, momentum may be stretched" : rsi < 30 ? "oversold, potential reversal signal" : rsi > 55 ? "positive momentum" : rsi < 45 ? "weakening momentum" : "balanced, no directional bias"}.${indicators.macd ? ` MACD histogram ${indicators.macd.histogram > 0 ? "positive (bullish)" : "negative (bearish)"}.` : ""}` : "Momentum data unavailable.",
    volatility: indicators.bollingerBands ? `Bollinger Band width at ${indicators.bollingerBands.bandwidth}% — ${indicators.bollingerBands.bandwidth < 5 ? "volatility squeeze forming, expect expansion" : indicators.bollingerBands.bandwidth > 15 ? "elevated volatility, wider position sizing warranted" : "normal volatility regime"}. ATR(14): $${indicators.atr14 ?? "N/A"}.` : "Volatility data unavailable.",
    keyLevels: buildFallbackLevels(indicators, quote.price),
    signals: buildFallbackSignals(indicators, quote.changePercent),
    indicators,
    extended,
    generatedAt: new Date().toISOString(),
    aiPowered: false,
  };
}

export async function generateTradeIdeas(limit: number = 10): Promise<object[]> {
  const candidates = ["AAPL", "NVDA", "MSFT", "META", "GOOGL", "AMZN", "TSLA", "AMD", "SPY", "QQQ"];
  const selected = candidates.slice(0, Math.min(limit, candidates.length));

  const ideas = await Promise.all(selected.map(async (symbol) => {
    const [quote, historyResult] = await Promise.all([
      getSingleQuote(symbol),
      getHistory(symbol, "1d", "3M"),
    ]);

    const bars: OHLCVBar[] = historyResult.candles.map(h => ({
      time: h.time, open: h.open, high: h.high, low: h.low, close: h.close, volume: h.volume,
    }));
    const indicators = computeIndicators(bars);

    const rsi = indicators.rsi14;
    const macdBullish = indicators.macd !== null ? indicators.macd.histogram > 0 : null;
    const aboveSma50 = indicators.priceVsSma50 !== null ? indicators.priceVsSma50 > 0 : null;
    const aboveSma200 = indicators.priceVsSma200 !== null ? indicators.priceVsSma200 > 0 : null;

    let bullScore = 0;
    if (rsi !== null) { if (rsi > 55) bullScore += 2; else if (rsi < 45) bullScore -= 2; }
    if (macdBullish === true) bullScore += 2; else if (macdBullish === false) bullScore -= 2;
    if (aboveSma50 === true) bullScore += 1; else if (aboveSma50 === false) bullScore -= 1;
    if (aboveSma200 === true) bullScore += 1; else if (aboveSma200 === false) bullScore -= 1;
    if (quote.changePercent > 1) bullScore += 1; else if (quote.changePercent < -1) bullScore -= 1;

    const bias = bullScore >= 2 ? "bullish" : bullScore <= -2 ? "bearish" : "neutral";
    const side = bias === "bullish" ? "long" : bias === "bearish" ? "short" : (Math.random() > 0.5 ? "long" : "short");
    const price = quote.price;

    const atr = indicators.atr14 ?? price * 0.02;
    const entryLow = Math.round((price - atr * 0.3) * 100) / 100;
    const entryHigh = Math.round((price + atr * 0.3) * 100) / 100;

    const stopDist = atr * 1.5;
    const targetDist = atr * 3.5;

    const stopLow = side === "long" ? Math.round((price - stopDist * 1.1) * 100) / 100 : Math.round((price + stopDist * 0.9) * 100) / 100;
    const stopHigh = side === "long" ? Math.round((price - stopDist * 0.9) * 100) / 100 : Math.round((price + stopDist * 1.1) * 100) / 100;
    const target1 = side === "long" ? Math.round((price + targetDist * 0.8) * 100) / 100 : Math.round((price - targetDist * 0.8) * 100) / 100;
    const target2 = side === "long" ? Math.round((price + targetDist * 1.3) * 100) / 100 : Math.round((price - targetDist * 1.3) * 100) / 100;

    const riskReward = Math.round((targetDist / stopDist) * 10) / 10;
    const confidence = Math.min(40 + Math.abs(bullScore) * 8, 88);

    const rationale = buildRationale(symbol, side, bias, indicators, quote.changePercent, rsi, macdBullish, aboveSma50);

    return {
      id: `${symbol}-${Date.now()}`,
      symbol,
      side,
      entryZone: `$${Math.min(entryLow, entryHigh)} – $${Math.max(entryLow, entryHigh)}`,
      stopZone: `$${Math.min(stopLow, stopHigh)} – $${Math.max(stopLow, stopHigh)}`,
      targetZone: `$${Math.min(target1, target2)} – $${Math.max(target1, target2)}`,
      rationale,
      confidence,
      bias,
      riskReward,
      generatedAt: new Date().toISOString(),
    };
  }));

  return ideas;
}

function buildRationale(
  symbol: string, side: string, bias: string,
  indicators: ReturnType<typeof computeIndicators>,
  changePercent: number, rsi: number | null,
  macdBullish: boolean | null, aboveSma50: boolean | null
): string {
  const parts: string[] = [];

  if (rsi !== null) {
    if (rsi > 60) parts.push(`RSI(14) at ${rsi.toFixed(0)} shows positive momentum`);
    else if (rsi < 40) parts.push(`RSI(14) at ${rsi.toFixed(0)} indicates oversold conditions`);
    else parts.push(`RSI(14) at ${rsi.toFixed(0)} is neutral`);
  }

  if (macdBullish !== null) {
    parts.push(`MACD histogram is ${macdBullish ? "positive (bullish crossover)" : "negative (bearish crossover)"}`);
  }

  if (aboveSma50 !== null && indicators.priceVsSma50 !== null) {
    parts.push(`price is ${Math.abs(indicators.priceVsSma50).toFixed(1)}% ${aboveSma50 ? "above" : "below"} the 50-day SMA`);
  }

  if (indicators.volumeRatio !== null && indicators.volumeRatio > 1.3) {
    parts.push(`volume is ${indicators.volumeRatio}x average confirming the move`);
  }

  parts.push(`${Math.abs(changePercent).toFixed(2)}% ${changePercent >= 0 ? "gain" : "decline"} today`);

  const setup = parts.join(", ") + ".";
  return `${symbol} ${bias} ${side} setup: ${setup} Stop uses 1.5× ATR; target 3.5× ATR for ~2.3:1 R/R. Paper trading only — not financial advice.`;
}
