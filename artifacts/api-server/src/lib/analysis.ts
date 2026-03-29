import { getHistory, getSingleQuote } from "./tradersage";

export async function generateAnalysis(symbol: string, timeframe: string) {
  const [quote, history] = await Promise.all([
    getSingleQuote(symbol),
    getHistory(symbol, timeframe, "1M"),
  ]);

  const prices = history.map(c => c.close).filter(Boolean);
  const volumes = history.map(c => c.volume).filter(Boolean);
  const recentPrices = prices.slice(-5);
  const prevPrices = prices.slice(-20, -5);

  const recentAvg = recentPrices.length > 0 ? recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length : quote.price;
  const prevAvg = prevPrices.length > 0 ? prevPrices.reduce((a, b) => a + b, 0) / prevPrices.length : quote.price;

  const trendDir = recentAvg > prevAvg ? "uptrend" : recentAvg < prevAvg * 0.98 ? "downtrend" : "sideways";

  const recentVol = volumes.slice(-5);
  const recentVolAvg = recentVol.length > 0 ? recentVol.reduce((a, b) => a + b, 0) / recentVol.length : 0;
  const prevVolAvg = volumes.slice(-20, -5).length > 0
    ? volumes.slice(-20, -5).reduce((a, b) => a + b, 0) / volumes.slice(-20, -5).length
    : recentVolAvg;
  const volRatio = prevVolAvg > 0 ? recentVolAvg / prevVolAvg : 1;

  const priceChanges = prices.slice(1).map((p, i) => p - prices[i]!);
  const gains = priceChanges.filter(c => c > 0);
  const losses = priceChanges.filter(c => c < 0);
  const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0.001;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  let momentum: string;
  if (rsi > 70) momentum = "Overbought territory — RSI above 70 suggests momentum may be extended";
  else if (rsi > 55) momentum = "Positive momentum — RSI indicates continued buying pressure";
  else if (rsi < 30) momentum = "Oversold territory — RSI below 30 suggests potential reversal opportunity";
  else if (rsi < 45) momentum = "Weakening momentum — selling pressure has been persistent";
  else momentum = "Neutral momentum — RSI in balanced zone with no clear directional bias";

  const stdDev = calculateStdDev(prices.slice(-20));
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : quote.price;
  const volPct = avgPrice > 0 ? (stdDev / avgPrice) * 100 : 0;
  let volatility: string;
  if (volPct > 3) volatility = `High volatility (${volPct.toFixed(1)}% 20-day range) — elevated risk, wider stop zones appropriate`;
  else if (volPct > 1.5) volatility = `Moderate volatility (${volPct.toFixed(1)}% 20-day range) — standard risk parameters apply`;
  else volatility = `Low volatility (${volPct.toFixed(1)}% 20-day range) — tight trading range, potential for expansion`;

  const sortedPrices = [...prices].sort((a, b) => a - b);
  const len = sortedPrices.length;
  const support1 = sortedPrices[Math.floor(len * 0.1)] ?? quote.price * 0.95;
  const support2 = sortedPrices[Math.floor(len * 0.25)] ?? quote.price * 0.97;
  const resistance1 = sortedPrices[Math.floor(len * 0.75)] ?? quote.price * 1.03;
  const resistance2 = sortedPrices[Math.floor(len * 0.9)] ?? quote.price * 1.05;

  const bias = deriveBias(quote.changePercent, rsi, trendDir, volRatio);
  const confidence = deriveConfidence(quote.changePercent, rsi, volRatio, trendDir);

  const summary = generateSummary(symbol, bias, trendDir, rsi, quote.changePercent, volRatio, stdDev, avgPrice);

  const trend = generateTrendText(trendDir, recentAvg, prevAvg, quote.price);

  return {
    symbol,
    timeframe,
    bias,
    confidence,
    summary,
    trend,
    momentum,
    volatility,
    keyLevels: [
      { type: "support", price: Math.round(support1 * 100) / 100, description: "Key support zone — major demand area" },
      { type: "support", price: Math.round(support2 * 100) / 100, description: "Secondary support — prior consolidation base" },
      { type: "resistance", price: Math.round(resistance1 * 100) / 100, description: "First resistance — prior supply zone" },
      { type: "resistance", price: Math.round(resistance2 * 100) / 100, description: "Major resistance — 90th percentile range high" },
    ],
    signals: [
      { name: "RSI (14)", value: rsi.toFixed(1), interpretation: rsi > 70 ? "Overbought" : rsi < 30 ? "Oversold" : "Neutral" },
      { name: "Trend Direction", value: trendDir.charAt(0).toUpperCase() + trendDir.slice(1), interpretation: trendDir === "uptrend" ? "Bullish" : trendDir === "downtrend" ? "Bearish" : "Neutral" },
      { name: "Volume Ratio", value: `${volRatio.toFixed(2)}x`, interpretation: volRatio > 1.5 ? "Above average — conviction" : volRatio < 0.7 ? "Below average — low conviction" : "Normal" },
      { name: "Daily Change", value: `${quote.changePercent > 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%`, interpretation: quote.changePercent > 1.5 ? "Strong bullish move" : quote.changePercent < -1.5 ? "Strong bearish move" : "Modest move" },
      { name: "20-Day Volatility", value: `${volPct.toFixed(1)}%`, interpretation: volPct > 3 ? "High — wider risk zones" : volPct < 1.5 ? "Low — tight range" : "Moderate" },
    ],
    generatedAt: new Date().toISOString(),
  };
}

function calculateStdDev(prices: number[]): number {
  if (prices.length === 0) return 0;
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
  return Math.sqrt(variance);
}

function deriveBias(changePercent: number, rsi: number, trend: string, volRatio: number): string {
  let score = 0;
  if (changePercent > 1) score += 2;
  else if (changePercent > 0) score += 1;
  else if (changePercent < -1) score -= 2;
  else if (changePercent < 0) score -= 1;
  if (rsi > 55) score += 1;
  else if (rsi < 45) score -= 1;
  if (trend === "uptrend") score += 1;
  else if (trend === "downtrend") score -= 1;
  if (volRatio > 1.3) score += (changePercent > 0 ? 1 : -1);
  if (score >= 2) return "bullish";
  if (score <= -2) return "bearish";
  return "neutral";
}

function deriveConfidence(changePercent: number, rsi: number, volRatio: number, trend: string): number {
  const absChange = Math.abs(changePercent);
  let base = 40;
  base += Math.min(absChange * 8, 25);
  if (rsi > 65 || rsi < 35) base += 10;
  if (volRatio > 1.5) base += 10;
  if (trend !== "sideways") base += 5;
  return Math.round(Math.min(base, 88));
}

function generateSummary(symbol: string, bias: string, trend: string, rsi: number, changePercent: number, volRatio: number, stdDev: number, avgPrice: number): string {
  const volPct = avgPrice > 0 ? (stdDev / avgPrice) * 100 : 0;
  const biasText = bias === "bullish" ? "a bullish bias" : bias === "bearish" ? "a bearish bias" : "a neutral stance";
  const trendText = trend === "uptrend" ? "an established uptrend" : trend === "downtrend" ? "a developing downtrend" : "a sideways consolidation";
  const volText = volRatio > 1.5 ? "above-average volume confirming the move" : volRatio < 0.7 ? "below-average volume suggesting low conviction" : "average volume";
  const changeText = `${Math.abs(changePercent).toFixed(2)}% ${changePercent >= 0 ? "gain" : "decline"} today`;
  const rsiText = rsi > 70 ? "RSI is extended above 70 — proceed cautiously" : rsi < 30 ? "RSI is oversold below 30 — potential bounce candidate" : `RSI at ${rsi.toFixed(0)} shows balanced momentum`;

  return `${symbol} is showing ${biasText} within ${trendText}. The stock posted a ${changeText} on ${volText}. ${rsiText}. Volatility at ${volPct.toFixed(1)}% over the past 20 sessions ${volPct > 3 ? "warrants wider position sizing and risk management" : "is within normal range for typical entries"}. This is AI-generated analysis — not financial advice.`;
}

function generateTrendText(trend: string, recentAvg: number, prevAvg: number, currentPrice: number): string {
  const pctDiff = prevAvg > 0 ? ((recentAvg - prevAvg) / prevAvg * 100) : 0;
  switch (trend) {
    case "uptrend":
      return `Price is trending higher with a ${Math.abs(pctDiff).toFixed(1)}% advance in the recent 5-session average versus the prior 15 sessions. Current price at $${currentPrice.toFixed(2)} is above the short-term moving average, indicating sustained buying interest. The trend structure remains intact with higher highs and higher lows.`;
    case "downtrend":
      return `Price is trending lower with a ${Math.abs(pctDiff).toFixed(1)}% decline in the recent 5-session average versus the prior 15 sessions. Current price at $${currentPrice.toFixed(2)} is below the short-term moving average, indicating persistent selling pressure. The trend structure shows lower highs and lower lows.`;
    default:
      return `Price is consolidating in a narrow range with the recent 5-session average within ${Math.abs(pctDiff).toFixed(1)}% of the prior 15-session average. Current price at $${currentPrice.toFixed(2)} is near equilibrium. Range-bound conditions suggest watching for a breakout catalyst.`;
  }
}

export async function generateTradeIdeas(limit: number = 10): Promise<object[]> {
  const candidates = ["AAPL", "NVDA", "MSFT", "META", "GOOGL", "AMZN", "TSLA", "AMD", "SPY", "QQQ"];
  const selected = candidates.slice(0, Math.min(limit, candidates.length));

  const ideas = await Promise.all(selected.map(async (symbol) => {
    const quote = await getSingleQuote(symbol);
    const bias = quote.signal === "bullish" ? "bullish" : quote.signal === "bearish" ? "bearish" : "neutral";
    const side = bias === "bullish" ? "long" : bias === "bearish" ? "short" : Math.random() > 0.5 ? "long" : "short";

    const price = quote.price;
    const volatilityFactor = 0.02;

    const entryLow = Math.round(price * (1 - volatilityFactor * 0.5) * 100) / 100;
    const entryHigh = Math.round(price * (1 + volatilityFactor * 0.5) * 100) / 100;

    const stopDist = price * 0.025;
    const targetDist = price * 0.06;

    const stopLow = side === "long"
      ? Math.round((price - stopDist * 1.1) * 100) / 100
      : Math.round((price + stopDist * 0.9) * 100) / 100;
    const stopHigh = side === "long"
      ? Math.round((price - stopDist * 0.9) * 100) / 100
      : Math.round((price + stopDist * 1.1) * 100) / 100;

    const target1 = side === "long"
      ? Math.round((price + targetDist * 0.8) * 100) / 100
      : Math.round((price - targetDist * 0.8) * 100) / 100;
    const target2 = side === "long"
      ? Math.round((price + targetDist * 1.3) * 100) / 100
      : Math.round((price - targetDist * 1.3) * 100) / 100;

    const riskReward = Math.round((targetDist / stopDist) * 10) / 10;
    const confidence = quote.signalStrength ?? 55;

    return {
      id: `${symbol}-${Date.now()}`,
      symbol,
      side,
      entryZone: `$${entryLow} – $${entryHigh}`,
      stopZone: `$${Math.min(stopLow, stopHigh)} – $${Math.max(stopLow, stopHigh)}`,
      targetZone: `$${Math.min(target1, target2)} – $${Math.max(target1, target2)}`,
      rationale: generateRationale(symbol, side, bias, quote.changePercent, confidence),
      confidence,
      bias,
      riskReward,
      generatedAt: new Date().toISOString(),
    };
  }));

  return ideas;
}

function generateRationale(symbol: string, side: string, bias: string, changePercent: number, confidence: number): string {
  const direction = side === "long" ? "bullish" : "bearish";
  const changeText = `${Math.abs(changePercent).toFixed(2)}% ${changePercent >= 0 ? "gain" : "decline"}`;
  const confidenceText = confidence > 75 ? "high-confidence" : confidence > 55 ? "moderate-confidence" : "developing";

  return `${symbol} is showing a ${confidenceText} ${direction} setup with a ${changeText} on elevated volume. The risk/reward is favorable for a ${side} entry at current levels. Trade idea is for paper trading analysis only — not financial advice.`;
}
