import { computeIndicators, type OHLCVBar } from "./technicals";

export type MarketRegime = "strong-bull" | "bull" | "neutral" | "bear" | "strong-bear";

export interface RegimeResult {
  regime: MarketRegime;
  label: string;
  description: string;
  color: "bullish" | "neutral" | "bearish";
  score: number;
  signals: { name: string; value: string; bullish: boolean | null }[];
  recommendedStrategy: string;
}

export function detectMarketRegime(bars: OHLCVBar[], symbol: string = "SPY"): RegimeResult {
  if (!bars || bars.length < 20) {
    return {
      regime: "neutral",
      label: "Neutral",
      description: "Insufficient data to determine market regime.",
      color: "neutral",
      score: 0,
      signals: [],
      recommendedStrategy: "Hold current positions. Wait for more data.",
    };
  }

  const indicators = computeIndicators(bars);
  const signals: { name: string; value: string; bullish: boolean | null }[] = [];
  let score = 0;

  const rsi = indicators.rsi14;
  if (rsi !== null) {
    const bullish = rsi > 50 && rsi < 70;
    const val = rsi > 70 ? "Overbought" : rsi > 50 ? "Bullish" : rsi > 30 ? "Bearish" : "Oversold";
    signals.push({ name: "RSI Momentum", value: `${rsi.toFixed(0)} — ${val}`, bullish: rsi > 50 ? true : rsi < 40 ? false : null });
    score += rsi > 60 ? 2 : rsi > 50 ? 1 : rsi < 40 ? -2 : rsi < 30 ? -3 : -1;
  }

  const macd = indicators.macd;
  if (macd) {
    const bullish = macd.histogram > 0;
    signals.push({ name: "Trend (MACD)", value: macd.histogram > 0 ? `Uptrend (+${macd.histogram.toFixed(2)})` : `Downtrend (${macd.histogram.toFixed(2)})`, bullish });
    score += bullish ? 2 : -2;
    if (Math.abs(macd.histogram) > 1) score += bullish ? 1 : -1;
  }

  const sma50 = indicators.priceVsSma50;
  if (sma50 !== null) {
    const bullish = sma50 > 0;
    signals.push({ name: "Price vs 50-day Avg", value: `${sma50 >= 0 ? "+" : ""}${sma50.toFixed(1)}% ${bullish ? "above" : "below"}`, bullish });
    score += bullish ? 1.5 : -1.5;
  }

  const sma200 = indicators.priceVsSma200;
  if (sma200 !== null) {
    const bullish = sma200 > 0;
    signals.push({ name: "Long-term Trend (200d)", value: `${sma200 >= 0 ? "+" : ""}${sma200.toFixed(1)}% ${bullish ? "above" : "below"}`, bullish });
    score += bullish ? 2 : -2;
  }

  const vol = indicators.volumeRatio;
  if (vol !== null) {
    const high = vol > 1.5;
    signals.push({ name: "Volume", value: `${vol.toFixed(1)}x average${high ? " (surge)" : ""}`, bullish: high ? null : null });
  }

  const bb = indicators.bollingerBands;
  const lastBar = bars[bars.length - 1];
  if (bb && lastBar) {
    const pctB = (lastBar.close - bb.lower) / (bb.upper - bb.lower);
    const bullish = pctB > 0.5;
    signals.push({
      name: "Price Band Position",
      value: pctB > 0.8 ? "Near upper band (strong)" : pctB > 0.5 ? "Upper half (bullish)" : pctB > 0.2 ? "Lower half (bearish)" : "Near lower band (weak)",
      bullish
    });
    score += pctB > 0.7 ? 1 : pctB < 0.3 ? -1 : 0;
  }

  const recentBars = bars.slice(-10);
  const recentReturn = recentBars.length > 1
    ? (recentBars[recentBars.length - 1]!.close - recentBars[0]!.close) / recentBars[0]!.close * 100
    : 0;
  signals.push({
    name: "10-Day Price Action",
    value: `${recentReturn >= 0 ? "+" : ""}${recentReturn.toFixed(1)}%`,
    bullish: recentReturn > 1 ? true : recentReturn < -1 ? false : null
  });
  score += recentReturn > 3 ? 2 : recentReturn > 1 ? 1 : recentReturn < -3 ? -2 : recentReturn < -1 ? -1 : 0;

  let regime: MarketRegime;
  let label: string;
  let description: string;
  let color: "bullish" | "neutral" | "bearish";
  let strategy: string;

  if (score >= 7) {
    regime = "strong-bull"; label = "Strong Bull Market";
    description = `${symbol} is in a powerful uptrend. Multiple indicators confirm strong buying pressure and positive momentum.`;
    color = "bullish";
    strategy = "Aggressively buy dips. Increase position sizes. Hold winners longer.";
  } else if (score >= 3) {
    regime = "bull"; label = "Bull Market";
    description = `${symbol} is trending upward. The weight of evidence favors buyers. Good environment for long positions.`;
    color = "bullish";
    strategy = "Buy on pullbacks. Standard position sizes. Keep stop losses moderate.";
  } else if (score >= -2) {
    regime = "neutral"; label = "Neutral / Choppy Market";
    description = `${symbol} lacks clear direction. Mixed signals suggest the market is deciding its next move.`;
    color = "neutral";
    strategy = "Reduce position sizes. Trade ranges. Avoid chasing moves.";
  } else if (score >= -6) {
    regime = "bear"; label = "Bear Market";
    description = `${symbol} is under selling pressure. Downtrend is in effect. Capital preservation is the priority.`;
    color = "bearish";
    strategy = "Avoid new longs. Tighten stop losses. Consider reducing exposure.";
  } else {
    regime = "strong-bear"; label = "Strong Bear Market";
    description = `${symbol} is in a deep downtrend. Multiple indicators confirm heavy selling. Stay in cash.`;
    color = "bearish";
    strategy = "Stay mostly in cash. No new long positions. Wait for regime change.";
  }

  return { regime, label, description, color, score: Math.round(score * 10) / 10, signals, recommendedStrategy: strategy };
}
