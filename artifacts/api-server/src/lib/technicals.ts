export interface OHLCVBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  rsi14: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema9: number | null;
  ema21: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
  bollingerBands: { upper: number; middle: number; lower: number; bandwidth: number } | null;
  atr14: number | null;
  vwap: number | null;
  volumeRatio: number | null;
  priceVsSma20: number | null;
  priceVsSma50: number | null;
  priceVsSma200: number | null;
  highOf52w: number | null;
  lowOf52w: number | null;
  pctFromHigh: number | null;
}

function sma(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let emaVal = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    emaVal = prices[i]! * k + emaVal * (1 - k);
  }
  return emaVal;
}

function computeRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  const changes = prices.slice(1).map((p, i) => p - prices[i]!);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const c = changes[i]!;
    if (c > 0) avgGain += c;
    else avgLoss += Math.abs(c);
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period; i < changes.length; i++) {
    const c = changes[i]!;
    avgGain = (avgGain * (period - 1) + Math.max(c, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-c, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function computeMACD(prices: number[]): { macd: number; signal: number; histogram: number } | null {
  if (prices.length < 35) return null;
  const ema12 = ema(prices, 12);
  const ema26 = ema(prices, 26);
  if (ema12 === null || ema26 === null) return null;
  const macdLine = ema12 - ema26;
  const recentMACD = prices.slice(-26).map((_, i) => {
    const sub = prices.slice(0, prices.length - 26 + i + 1);
    const e12 = ema(sub, 12);
    const e26 = ema(sub, 26);
    return e12 !== null && e26 !== null ? e12 - e26 : null;
  }).filter((v): v is number => v !== null);
  const signalLine = ema(recentMACD, 9);
  if (signalLine === null) return null;
  return {
    macd: Math.round(macdLine * 1000) / 1000,
    signal: Math.round(signalLine * 1000) / 1000,
    histogram: Math.round((macdLine - signalLine) * 1000) / 1000,
  };
}

function computeBollingerBands(prices: number[], period = 20, stdDevMult = 2): { upper: number; middle: number; lower: number; bandwidth: number } | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  const upper = middle + stdDevMult * stdDev;
  const lower = middle - stdDevMult * stdDev;
  const bandwidth = middle > 0 ? ((upper - lower) / middle) * 100 : 0;
  return {
    upper: Math.round(upper * 100) / 100,
    middle: Math.round(middle * 100) / 100,
    lower: Math.round(lower * 100) / 100,
    bandwidth: Math.round(bandwidth * 100) / 100,
  };
}

function computeATR(bars: OHLCVBar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const trValues: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i]!.high;
    const l = bars[i]!.low;
    const pc = bars[i - 1]!.close;
    trValues.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return trValues.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function computeVWAP(bars: OHLCVBar[]): number | null {
  if (bars.length === 0) return null;
  let totalPV = 0;
  let totalV = 0;
  for (const bar of bars) {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    totalPV += typicalPrice * bar.volume;
    totalV += bar.volume;
  }
  return totalV > 0 ? Math.round((totalPV / totalV) * 100) / 100 : null;
}

export function computeIndicators(bars: OHLCVBar[]): TechnicalIndicators {
  if (bars.length === 0) {
    return {
      rsi14: null, sma20: null, sma50: null, sma200: null,
      ema9: null, ema21: null, macd: null, bollingerBands: null,
      atr14: null, vwap: null, volumeRatio: null,
      priceVsSma20: null, priceVsSma50: null, priceVsSma200: null,
      highOf52w: null, lowOf52w: null, pctFromHigh: null,
    };
  }

  const closes = bars.map(b => b.close);
  const volumes = bars.map(b => b.volume);
  const currentPrice = closes[closes.length - 1]!;

  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const s200 = sma(closes, 200);
  const e9 = ema(closes, 9);
  const e21 = ema(closes, 21);

  const recentVol = volumes.slice(-5);
  const prevVol = volumes.slice(-20, -5);
  const recentVolAvg = recentVol.length > 0 ? recentVol.reduce((a, b) => a + b, 0) / recentVol.length : 0;
  const prevVolAvg = prevVol.length > 0 ? prevVol.reduce((a, b) => a + b, 0) / prevVol.length : recentVolAvg;
  const volRatio = prevVolAvg > 0 ? recentVolAvg / prevVolAvg : null;

  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const high52w = highs.length > 0 ? Math.max(...highs) : null;
  const low52w = lows.length > 0 ? Math.min(...lows) : null;
  const pctFromHigh = high52w && high52w > 0 ? ((currentPrice - high52w) / high52w) * 100 : null;

  return {
    rsi14: computeRSI(closes) !== null ? Math.round(computeRSI(closes)! * 10) / 10 : null,
    sma20: s20 !== null ? Math.round(s20 * 100) / 100 : null,
    sma50: s50 !== null ? Math.round(s50 * 100) / 100 : null,
    sma200: s200 !== null ? Math.round(s200 * 100) / 100 : null,
    ema9: e9 !== null ? Math.round(e9 * 100) / 100 : null,
    ema21: e21 !== null ? Math.round(e21 * 100) / 100 : null,
    macd: computeMACD(closes),
    bollingerBands: computeBollingerBands(closes),
    atr14: computeATR(bars) !== null ? Math.round(computeATR(bars)! * 100) / 100 : null,
    vwap: computeVWAP(bars),
    volumeRatio: volRatio !== null ? Math.round(volRatio * 100) / 100 : null,
    priceVsSma20: s20 !== null ? Math.round(((currentPrice - s20) / s20) * 10000) / 100 : null,
    priceVsSma50: s50 !== null ? Math.round(((currentPrice - s50) / s50) * 10000) / 100 : null,
    priceVsSma200: s200 !== null ? Math.round(((currentPrice - s200) / s200) * 10000) / 100 : null,
    highOf52w: high52w !== null ? Math.round(high52w * 100) / 100 : null,
    lowOf52w: low52w !== null ? Math.round(low52w * 100) / 100 : null,
    pctFromHigh: pctFromHigh !== null ? Math.round(pctFromHigh * 100) / 100 : null,
  };
}

export function interpretIndicators(indicators: TechnicalIndicators, currentPrice: number): string {
  const lines: string[] = [];

  if (indicators.rsi14 !== null) {
    const rsi = indicators.rsi14;
    if (rsi >= 70) lines.push(`RSI(14) at ${rsi} — overbought territory, momentum may be stretched`);
    else if (rsi >= 55) lines.push(`RSI(14) at ${rsi} — positive momentum with room before overbought`);
    else if (rsi <= 30) lines.push(`RSI(14) at ${rsi} — oversold territory, watch for reversal signals`);
    else if (rsi <= 45) lines.push(`RSI(14) at ${rsi} — weakening momentum, sellers have the edge`);
    else lines.push(`RSI(14) at ${rsi} — neutral zone, no clear directional edge`);
  }

  if (indicators.sma20 !== null && indicators.sma50 !== null) {
    const pctVs20 = indicators.priceVsSma20!;
    const crossStatus = indicators.sma20 > indicators.sma50 ? "golden cross formation (SMA20 > SMA50, bullish)" : "death cross formation (SMA20 < SMA50, bearish)";
    lines.push(`Price is ${Math.abs(pctVs20).toFixed(1)}% ${pctVs20 >= 0 ? 'above' : 'below'} SMA20 — ${crossStatus}`);
  }

  if (indicators.sma200 !== null) {
    const pctVs200 = indicators.priceVsSma200!;
    lines.push(`Price is ${Math.abs(pctVs200).toFixed(1)}% ${pctVs200 >= 0 ? 'above' : 'below'} the 200-day SMA (${pctVs200 >= 0 ? 'technically in uptrend' : 'technically in downtrend'})`);
  }

  if (indicators.macd !== null) {
    const { macd, signal, histogram } = indicators.macd;
    const crossStatus = macd > signal ? "MACD above signal line (bullish)" : "MACD below signal line (bearish)";
    lines.push(`MACD: ${macd.toFixed(3)} / Signal: ${signal.toFixed(3)} / Histogram: ${histogram.toFixed(3)} — ${crossStatus}`);
  }

  if (indicators.bollingerBands !== null) {
    const { upper, middle, lower, bandwidth } = indicators.bollingerBands;
    if (currentPrice > upper) lines.push(`Price above upper Bollinger Band ($${upper}) — extended, potential mean reversion`);
    else if (currentPrice < lower) lines.push(`Price below lower Bollinger Band ($${lower}) — compressed, potential bounce`);
    else lines.push(`Price within Bollinger Bands ($${lower}–$${upper}), bandwidth ${bandwidth}% — ${bandwidth < 5 ? 'squeeze forming, expect expansion' : 'normal range'}`);
  }

  if (indicators.volumeRatio !== null) {
    const vr = indicators.volumeRatio;
    if (vr > 1.5) lines.push(`Volume ratio ${vr}x vs 15-day average — elevated volume confirms price action`);
    else if (vr < 0.6) lines.push(`Volume ratio ${vr}x vs 15-day average — weak volume, low-conviction move`);
    else lines.push(`Volume ratio ${vr}x vs 15-day average — in-line with recent norms`);
  }

  if (indicators.pctFromHigh !== null) {
    lines.push(`${Math.abs(indicators.pctFromHigh).toFixed(1)}% from 52-week high of $${indicators.highOf52w}`);
  }

  return lines.join('. ');
}
