import { openai } from "./openai-client";
import { getHistory, getSingleQuote } from "./tradersage";
import { computeIndicators, interpretIndicators, type OHLCVBar } from "./technicals";
import { computeExtendedIndicators, interpretExtendedIndicators, type ExtendedIndicators } from "./indicators-extended";
import { analyzePatterns, interpretPatterns } from "./patterns";
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
  const extended = await computeExtendedIndicators(bars);

  const patterns = analyzePatterns(bars, indicators.rsiSeries);

  if (!pendingAnalysis.has(cacheKey)) {
    pendingAnalysis.add(cacheKey);
    runLLMInBackground(symbol, timeframe, cacheKey, quote, indicators, extended, bars, patterns);
  }

  return { ...buildFallbackAnalysis(symbol, timeframe, quote, indicators, extended, patterns), isMock: quote.isMock || historyResult.isMock };
}

async function runLLMInBackground(
  symbol: string,
  timeframe: string,
  cacheKey: string,
  quote: { price: number; changePercent: number },
  indicators: ReturnType<typeof computeIndicators>,
  extended: ExtendedIndicators,
  _bars: OHLCVBar[],
  patterns: ReturnType<typeof analyzePatterns>
) {
  const indicatorSummary = interpretIndicators(indicators, quote.price);
  const extendedSummary = interpretExtendedIndicators(extended, quote.price);
  const patternSummary = interpretPatterns(patterns, quote.price);

  const { levels } = patterns;
  const divergenceText = patterns.divergence.description ?? "No RSI divergence detected";
  const detectedPatterns = patterns.patterns.length > 0
    ? patterns.patterns.map(p => `${p.type} (${p.direction}, ${p.confidence}% confidence): ${p.description}`).join("\n")
    : "No chart patterns detected in recent data";

  const maSignalText = indicators.maSignal === "golden-cross"
    ? "GOLDEN CROSS just occurred (50d crossed above 200d) — major institutional bullish signal"
    : indicators.maSignal === "death-cross"
    ? "DEATH CROSS just occurred (50d crossed below 200d) — major institutional bearish signal"
    : "No recent MA crossover event";

  const volSpikeText = indicators.volumeSpike
    ? `VOLUME SPIKE: ${indicators.volumeRatio}x average — high conviction move`
    : `Volume at ${indicators.volumeRatio ?? "N/A"}x average — normal activity`;

  const prompt = `You are a professional quantitative analyst generating a technical analysis report for a trading terminal. Analyze all data below and return a structured JSON object.

SYMBOL: ${symbol} | PRICE: $${quote.price} | CHANGE: ${quote.changePercent > 0 ? "+" : ""}${quote.changePercent.toFixed(2)}% | TIMEFRAME: ${timeframe}

════════════════════════════════════════
CHART PATTERN ANALYSIS (highest priority signals):
${detectedPatterns}

RSI DIVERGENCE: ${divergenceText}
MA CROSSOVER EVENT: ${maSignalText}
${volSpikeText}

PATTERN CONFLUENCE: ${patterns.confluence.bullishCount} bullish vs ${patterns.confluence.bearishCount} bearish signals → ${patterns.confluence.dominantBias.toUpperCase()} bias

════════════════════════════════════════
SUPPORT & RESISTANCE LEVELS:
- Nearest support: ${levels.nearestSupport ? `$${levels.nearestSupport}` : "Not identified"}
- Nearest resistance: ${levels.nearestResistance ? `$${levels.nearestResistance}` : "Not identified"}
- Pivot Point: ${levels.pivotPoint ? `$${levels.pivotPoint}` : "N/A"} | R1: $${levels.r1 ?? "N/A"} | R2: $${levels.r2 ?? "N/A"} | S1: $${levels.s1 ?? "N/A"} | S2: $${levels.s2 ?? "N/A"}
- Support cluster(s): ${levels.supports.length > 0 ? levels.supports.map(s => `$${s}`).join(", ") : "None identified"}
- Resistance cluster(s): ${levels.resistances.length > 0 ? levels.resistances.map(r => `$${r}`).join(", ") : "None identified"}

════════════════════════════════════════
TECHNICAL INDICATORS:
${indicatorSummary}

EXTENDED INDICATORS:
${extendedSummary || "Insufficient data"}

RAW VALUES:
- RSI(14): ${indicators.rsi14 ?? "N/A"} | RSI series (last 10): [${indicators.rsiSeries.slice(-10).join(", ")}]
- SMA20: $${indicators.sma20 ?? "N/A"} (${indicators.priceVsSma20 !== null ? (indicators.priceVsSma20 >= 0 ? "+" : "") + indicators.priceVsSma20 + "%" : "N/A"} from price)
- SMA50: $${indicators.sma50 ?? "N/A"} (${indicators.priceVsSma50 !== null ? (indicators.priceVsSma50 >= 0 ? "+" : "") + indicators.priceVsSma50 + "%" : "N/A"} from price)
- SMA200: $${indicators.sma200 ?? "N/A"} (${indicators.priceVsSma200 !== null ? (indicators.priceVsSma200 >= 0 ? "+" : "") + indicators.priceVsSma200 + "%" : "N/A"} from price)
- EMA9: $${indicators.ema9 ?? "N/A"} | EMA21: $${indicators.ema21 ?? "N/A"}
- MACD: ${indicators.macd ? `${indicators.macd.macd.toFixed(3)} / Signal: ${indicators.macd.signal.toFixed(3)} / Histogram: ${indicators.macd.histogram.toFixed(3)}` : "N/A"}
- Bollinger Bands: ${indicators.bollingerBands ? `Upper $${indicators.bollingerBands.upper} / Middle $${indicators.bollingerBands.middle} / Lower $${indicators.bollingerBands.lower} / BW: ${indicators.bollingerBands.bandwidth}%` : "N/A"}
- ATR(14): ${indicators.atr14 ?? "N/A"} (${indicators.atr14 && quote.price > 0 ? ((indicators.atr14 / quote.price * 100).toFixed(2) + "% of price") : "N/A"})
- 52W High: $${indicators.highOf52w ?? "N/A"} (${indicators.pctFromHigh !== null ? indicators.pctFromHigh + "%" : "N/A"} from current) | 52W Low: $${indicators.lowOf52w ?? "N/A"}
- Stochastic %K/${extended.stochastic?.k ?? "N/A"} / %D: ${extended.stochastic?.d ?? "N/A"}
- Williams %R: ${extended.williamsR ?? "N/A"} | CCI(20): ${extended.cci ?? "N/A"}
- Parabolic SAR: $${extended.parabolicSAR ?? "N/A"} (${extended.parabolicSAR !== null ? (quote.price > extended.parabolicSAR ? "above SAR — uptrend" : "below SAR — downtrend") : "N/A"})
- ADX(14): ${extended.adx?.adx ?? "N/A"} (${extended.adx?.trendStrength ?? "N/A"}) +DI: ${extended.adx?.pdi ?? "N/A"} / -DI: ${extended.adx?.mdi ?? "N/A"}
- OBV trend: ${extended.obvTrend ?? "N/A"}
- Ichimoku: ${extended.ichimoku ? `${extended.ichimoku.aboveCloud ? "ABOVE" : "BELOW"} cloud ($${extended.ichimoku.cloudBottom}–$${extended.ichimoku.cloudTop}), Tenkan $${extended.ichimoku.tenkan}, Kijun $${extended.ichimoku.kijun}` : "N/A"}

════════════════════════════════════════
INSTRUCTIONS:
1. Weight chart patterns and divergence signals HIGHEST (they are structural)
2. Use RSI series to assess momentum trajectory, not just current value
3. Use support/resistance from pivot points and clusters to set key levels
4. ATR tells you volatility — factor this into confidence (high ATR = lower confidence)
5. Confluence of 4+ indicators in the same direction = high confidence

Return ONLY a valid JSON object:
{
  "bias": "bullish" | "bearish" | "neutral",
  "confidence": <integer 30-90; reduce if divergence conflicts with trend, raise if 5+ signals agree>,
  "summary": "<2-3 sentences citing specific values: price vs SMAs, RSI level, key pattern detected, what trader should watch. Be precise and actionable.>",
  "trend": "<1-2 sentences: SMA relationships, price position vs 200d, Ichimoku stance>",
  "momentum": "<1 sentence: RSI trajectory + MACD histogram direction + divergence if present>",
  "volatility": "<1 sentence: ATR as % of price + Bollinger bandwidth + what it means for position sizing>",
  "keyLevels": [
    { "type": "resistance", "price": <number from resistance clusters or R1/R2>, "description": "<why this level matters>" },
    { "type": "resistance", "price": <number>, "description": "<why>" },
    { "type": "support", "price": <number from support clusters or S1/S2>, "description": "<why>" },
    { "type": "support", "price": <number>, "description": "<why>" }
  ],
  "signals": [
    { "name": "RSI (14)", "value": "${indicators.rsi14 ?? "N/A"}", "interpretation": "Overbought|Oversold|Bullish|Bearish|Neutral" },
    { "name": "MACD", "value": "<histogram direction>", "interpretation": "Bullish|Bearish|Neutral" },
    { "name": "SMA Trend", "value": "<above/below 200d>", "interpretation": "Bullish|Bearish|Neutral" },
    { "name": "Chart Pattern", "value": "<pattern name or None>", "interpretation": "Bullish|Bearish|Neutral" },
    { "name": "Volume", "value": "${indicators.volumeRatio ?? "N/A"}x avg${indicators.volumeSpike ? " SPIKE" : ""}", "interpretation": "High Conviction|Low Conviction|Normal" },
    { "name": "RSI Divergence", "value": "${patterns.divergence.type ?? "None"}", "interpretation": "Bullish|Bearish|Neutral" }
  ]
}

Paper trading only — not financial advice. Cite actual numbers from the data.`;

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
      keyLevels: parsed.keyLevels ?? buildFallbackLevels(indicators, quote.price, patterns),
      signals: parsed.signals ?? buildFallbackSignals(indicators, quote.changePercent, patterns),
      indicators,
      extended,
      patternSummary: patternSummary || null,
      detectedPatterns: patterns.patterns,
      divergence: patterns.divergence,
      supportResistance: patterns.levels,
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

function buildFallbackLevels(indicators: ReturnType<typeof computeIndicators>, price: number, patterns?: ReturnType<typeof analyzePatterns>) {
  const levels: Array<{ type: string; price: number; description: string }> = [];

  if (patterns?.levels.nearestResistance) {
    levels.push({ type: "resistance", price: patterns.levels.nearestResistance, description: "Swing high resistance cluster" });
  } else if (patterns?.levels.r1) {
    levels.push({ type: "resistance", price: patterns.levels.r1, description: "Pivot R1 — first resistance target" });
  }
  if (patterns?.levels.nearestSupport) {
    levels.push({ type: "support", price: patterns.levels.nearestSupport, description: "Swing low support cluster" });
  } else if (patterns?.levels.s1) {
    levels.push({ type: "support", price: patterns.levels.s1, description: "Pivot S1 — first support level" });
  }

  if (indicators.bollingerBands) {
    levels.push({ type: "resistance", price: indicators.bollingerBands.upper, description: "Upper Bollinger Band — mean reversion resistance" });
    levels.push({ type: "support", price: indicators.bollingerBands.lower, description: "Lower Bollinger Band — mean reversion support" });
  }
  if (indicators.sma50) levels.push({ type: "support", price: indicators.sma50, description: "50-day SMA — key institutional level" });
  if (indicators.sma200) levels.push({ type: "support", price: indicators.sma200, description: "200-day SMA — primary trend line" });
  if (levels.length === 0) {
    levels.push({ type: "resistance", price: Math.round(price * 1.03 * 100) / 100, description: "Near-term resistance estimate" });
    levels.push({ type: "support", price: Math.round(price * 0.97 * 100) / 100, description: "Near-term support estimate" });
  }
  return levels.slice(0, 6);
}

function buildFallbackSignals(indicators: ReturnType<typeof computeIndicators>, changePercent: number, patterns?: ReturnType<typeof analyzePatterns>) {
  const rsi = indicators.rsi14;
  const topPattern = patterns?.patterns[0];
  const divergence = patterns?.divergence;
  return [
    { name: "RSI (14)", value: rsi?.toFixed(1) ?? "N/A", interpretation: rsi === null ? "N/A" : rsi > 70 ? "Overbought" : rsi < 30 ? "Oversold" : rsi > 55 ? "Bullish" : rsi < 45 ? "Bearish" : "Neutral" },
    { name: "MACD", value: indicators.macd ? `${indicators.macd.histogram > 0 ? "▲" : "▼"} ${Math.abs(indicators.macd.histogram).toFixed(3)}` : "N/A", interpretation: indicators.macd ? (indicators.macd.histogram > 0 ? "Bullish" : "Bearish") : "N/A" },
    { name: "SMA Trend", value: indicators.priceVsSma50 !== null ? `${indicators.priceVsSma50 >= 0 ? "+" : ""}${indicators.priceVsSma50}% vs SMA50` : "N/A", interpretation: indicators.priceVsSma50 !== null ? (indicators.priceVsSma50 > 0 ? "Bullish" : "Bearish") : "N/A" },
    { name: "Chart Pattern", value: topPattern ? topPattern.type : "None", interpretation: topPattern ? (topPattern.direction === "bullish" ? "Bullish" : "Bearish") : "Neutral" },
    { name: "Volume", value: indicators.volumeRatio ? `${indicators.volumeRatio}x avg${indicators.volumeSpike ? " SPIKE" : ""}` : "N/A", interpretation: indicators.volumeRatio ? (indicators.volumeSpike ? "High Conviction" : indicators.volumeRatio > 1.5 ? "High Conviction" : indicators.volumeRatio < 0.7 ? "Low Conviction" : "Normal") : "N/A" },
    { name: "RSI Divergence", value: divergence?.type ?? "None", interpretation: divergence?.type === "bullish" ? "Bullish" : divergence?.type === "bearish" ? "Bearish" : "Neutral" },
  ];
}

function buildFallbackAnalysis(symbol: string, timeframe: string, quote: { price: number; changePercent: number }, indicators: ReturnType<typeof computeIndicators>, extended: ExtendedIndicators, patterns?: ReturnType<typeof analyzePatterns>) {
  const rsi = indicators.rsi14;

  let biasBullish = 0;
  let biasBearish = 0;
  if (rsi !== null) { if (rsi > 60) biasBullish++; else if (rsi < 40) biasBearish++; }
  if (indicators.macd) { if (indicators.macd.histogram > 0) biasBullish++; else biasBearish++; }
  if (indicators.priceVsSma50 !== null) { if (indicators.priceVsSma50 > 0) biasBullish++; else biasBearish++; }
  if (patterns) { biasBullish += patterns.confluence.bullishCount; biasBearish += patterns.confluence.bearishCount; }

  const bias = biasBullish > biasBearish ? "bullish" : biasBearish > biasBullish ? "bearish" : "neutral";
  const confidence = rsi !== null ? Math.min(40 + Math.abs(rsi - 50), 88) : 50;

  const patternText = patterns && patterns.patterns.length > 0
    ? ` ${patterns.patterns.map(p => p.description.split(".")[0]).join("; ")}.`
    : "";
  const divergenceText = patterns?.divergence.description
    ? ` ${patterns.divergence.description.split(".")[0]}.`
    : "";

  return {
    symbol,
    timeframe,
    bias,
    confidence: Math.round(confidence),
    summary: `${symbol} at $${quote.price} (${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}% today). RSI(14) at ${rsi?.toFixed(1) ?? "N/A"} — ${rsi !== null ? (rsi > 70 ? "overbought territory" : rsi < 30 ? "oversold, potential reversal" : "neutral momentum zone") : "insufficient data"}.${patternText}${divergenceText} AI-enhanced analysis loading in background.`,
    trend: indicators.priceVsSma50 !== null ? `Price is ${Math.abs(indicators.priceVsSma50).toFixed(1)}% ${indicators.priceVsSma50 >= 0 ? "above" : "below"} the 50-day SMA ($${indicators.sma50}). ${indicators.sma20 && indicators.sma50 ? (indicators.sma20 > indicators.sma50 ? "SMA20 above SMA50 — short-term uptrend." : "SMA20 below SMA50 — short-term downtrend.") : ""}${indicators.maSignal !== "neutral" ? ` ${indicators.maSignal === "golden-cross" ? "GOLDEN CROSS just triggered." : "DEATH CROSS just triggered."}` : ""}` : "Insufficient data for trend analysis.",
    momentum: rsi !== null ? `RSI(14) at ${rsi.toFixed(1)} — ${rsi > 70 ? "overbought" : rsi < 30 ? "oversold, watch for reversal" : rsi > 55 ? "positive momentum" : rsi < 45 ? "weakening momentum" : "balanced"}.${indicators.macd ? ` MACD histogram ${indicators.macd.histogram > 0 ? "positive (bullish)" : "negative (bearish)"}.` : ""}${patterns?.divergence.type ? ` ${patterns.divergence.type === "bullish" ? "BULLISH" : "BEARISH"} RSI divergence detected.` : ""}` : "Momentum data unavailable.",
    volatility: indicators.bollingerBands ? `Bollinger Band width at ${indicators.bollingerBands.bandwidth}% — ${indicators.bollingerBands.bandwidth < 5 ? "volatility squeeze, expect expansion" : indicators.bollingerBands.bandwidth > 15 ? "elevated volatility, widen stops" : "normal regime"}. ATR(14): $${indicators.atr14 ?? "N/A"}${indicators.atr14 && quote.price > 0 ? ` (${(indicators.atr14 / quote.price * 100).toFixed(2)}% of price)` : ""}.` : "Volatility data unavailable.",
    keyLevels: buildFallbackLevels(indicators, quote.price, patterns),
    signals: buildFallbackSignals(indicators, quote.changePercent, patterns),
    indicators,
    extended,
    patternSummary: patterns ? interpretPatterns(patterns, quote.price) || null : null,
    detectedPatterns: patterns?.patterns ?? [],
    divergence: patterns?.divergence ?? { type: null, strength: null, description: null },
    supportResistance: patterns?.levels ?? null,
    generatedAt: new Date().toISOString(),
    aiPowered: false,
  };
}

export async function generateTradeIdeas(limit: number = 10): Promise<object[]> {
  const candidates = ["AAPL", "NVDA", "MSFT", "META", "GOOGL", "AMZN", "TSLA", "AMD", "SPY", "QQQ", "SMCI", "ARM", "PLTR", "COIN", "MSTR"];
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
    const patterns = analyzePatterns(bars, indicators.rsiSeries);

    const rsi = indicators.rsi14;
    const macdBullish = indicators.macd !== null ? indicators.macd.histogram > 0 : null;
    const aboveSma50 = indicators.priceVsSma50 !== null ? indicators.priceVsSma50 > 0 : null;
    const aboveSma200 = indicators.priceVsSma200 !== null ? indicators.priceVsSma200 > 0 : null;

    let bullScore = 0;
    if (rsi !== null) { if (rsi <= 30) bullScore += 3; else if (rsi > 55) bullScore += 2; else if (rsi < 45) bullScore -= 2; else if (rsi >= 70) bullScore -= 3; }
    if (macdBullish === true) bullScore += 2; else if (macdBullish === false) bullScore -= 2;
    if (aboveSma50 === true) bullScore += 1; else if (aboveSma50 === false) bullScore -= 1;
    if (aboveSma200 === true) bullScore += 2; else if (aboveSma200 === false) bullScore -= 2;
    if (quote.changePercent > 1) bullScore += 1; else if (quote.changePercent < -1) bullScore -= 1;
    if (indicators.maSignal === "golden-cross") bullScore += 3;
    if (indicators.maSignal === "death-cross") bullScore -= 3;
    bullScore += patterns.confluence.bullishCount * 2 - patterns.confluence.bearishCount * 2;
    if (patterns.divergence.type === "bullish") bullScore += 3;
    if (patterns.divergence.type === "bearish") bullScore -= 3;

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
    const baseConfidence = Math.min(40 + Math.abs(bullScore) * 6, 85);
    const patternBonus = patterns.patterns.length > 0 ? 5 : 0;
    const divergenceBonus = patterns.divergence.type ? 5 : 0;
    const confidence = Math.min(baseConfidence + patternBonus + divergenceBonus, 90);

    const rationale = buildRationale(symbol, side, bias, indicators, quote.changePercent, rsi, macdBullish, aboveSma50, patterns);

    const nearestKey = side === "long" ? patterns.levels.nearestSupport : patterns.levels.nearestResistance;
    const keyLevelNote = nearestKey ? ` Key ${side === "long" ? "support" : "resistance"} at $${nearestKey}.` : "";

    return {
      id: `${symbol}-${Date.now()}`,
      symbol,
      side,
      entryZone: `$${Math.min(entryLow, entryHigh).toFixed(2)} – $${Math.max(entryLow, entryHigh).toFixed(2)}`,
      stopZone: `$${Math.min(stopLow, stopHigh).toFixed(2)} – $${Math.max(stopLow, stopHigh).toFixed(2)}`,
      targetZone: `$${Math.min(target1, target2).toFixed(2)} – $${Math.max(target1, target2).toFixed(2)}`,
      rationale: rationale + keyLevelNote,
      confidence,
      bias,
      riskReward,
      score: bullScore,
      topPattern: patterns.patterns[0]?.type ?? null,
      divergence: patterns.divergence.type ?? null,
      maSignal: indicators.maSignal !== "neutral" ? indicators.maSignal : null,
      generatedAt: new Date().toISOString(),
    };
  }));

  return ideas.sort((a, b) => Math.abs((b as any).score) - Math.abs((a as any).score));
}

function buildRationale(
  symbol: string, side: string, bias: string,
  indicators: ReturnType<typeof computeIndicators>,
  changePercent: number, rsi: number | null,
  macdBullish: boolean | null, aboveSma50: boolean | null,
  patterns?: ReturnType<typeof analyzePatterns>
): string {
  const parts: string[] = [];

  if (patterns && patterns.patterns.length > 0) {
    const topPattern = patterns.patterns[0]!;
    parts.push(`${topPattern.type.replace(/-/g, " ")} pattern detected (${topPattern.confidence}% confidence)`);
  }

  if (patterns?.divergence.type) {
    parts.push(`${patterns.divergence.strength} ${patterns.divergence.type} RSI divergence — ${patterns.divergence.type === "bullish" ? "selling pressure exhausted" : "momentum failing"}`);
  }

  if (indicators.maSignal !== "neutral") {
    parts.push(`${indicators.maSignal === "golden-cross" ? "golden cross" : "death cross"} just triggered on SMA50/200`);
  }

  if (rsi !== null) {
    if (rsi <= 30) parts.push(`RSI(14) at ${rsi.toFixed(0)} — extreme oversold`);
    else if (rsi < 40) parts.push(`RSI(14) at ${rsi.toFixed(0)} — oversold conditions`);
    else if (rsi > 70) parts.push(`RSI(14) at ${rsi.toFixed(0)} — overbought, caution`);
    else if (rsi > 60) parts.push(`RSI(14) at ${rsi.toFixed(0)} — positive momentum`);
  }

  if (macdBullish !== null) {
    parts.push(`MACD ${macdBullish ? "bullish crossover" : "bearish crossover"}`);
  }

  if (aboveSma50 !== null && indicators.priceVsSma50 !== null) {
    parts.push(`price ${Math.abs(indicators.priceVsSma50).toFixed(1)}% ${aboveSma50 ? "above" : "below"} 50d SMA`);
  }

  if (indicators.volumeSpike) {
    parts.push(`volume spike ${indicators.volumeRatio}x avg — institutional activity`);
  } else if (indicators.volumeRatio !== null && indicators.volumeRatio > 1.3) {
    parts.push(`volume ${indicators.volumeRatio}x average`);
  }

  if (Math.abs(changePercent) > 0.5) {
    parts.push(`${Math.abs(changePercent).toFixed(2)}% ${changePercent >= 0 ? "gain" : "decline"} today`);
  }

  const setup = parts.join("; ") + ".";
  return `${symbol} ${bias} ${side} setup: ${setup} ATR-based stops: 1.5×ATR stop, 3.5×ATR target (~2.3:1 R/R). Paper trading only.`;
}
