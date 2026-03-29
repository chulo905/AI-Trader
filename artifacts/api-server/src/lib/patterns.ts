import type { OHLCVBar } from "./technicals";

export type PatternType =
  | "double-top"
  | "double-bottom"
  | "head-and-shoulders"
  | "inverse-head-and-shoulders"
  | "bullish-flag"
  | "bearish-flag"
  | "ascending-triangle"
  | "descending-triangle"
  | "golden-cross"
  | "death-cross";

export interface DetectedPattern {
  type: PatternType;
  direction: "bullish" | "bearish";
  confidence: number;
  description: string;
  keyLevel?: number;
}

export interface SwingPoint {
  index: number;
  price: number;
}

export interface SupportResistanceLevels {
  supports: number[];
  resistances: number[];
  nearestSupport: number | null;
  nearestResistance: number | null;
  pivotPoint: number | null;
  r1: number | null;
  r2: number | null;
  s1: number | null;
  s2: number | null;
}

export interface RSIDivergence {
  type: "bullish" | "bearish" | null;
  strength: "strong" | "moderate" | null;
  description: string | null;
}

export interface PatternAnalysis {
  patterns: DetectedPattern[];
  divergence: RSIDivergence;
  levels: SupportResistanceLevels;
  confluence: {
    bullishCount: number;
    bearishCount: number;
    dominantBias: "bullish" | "bearish" | "neutral";
    score: number;
  };
}

function findSwingHighs(bars: OHLCVBar[], lookback = 4): SwingPoint[] {
  const result: SwingPoint[] = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    const price = bars[i]!.high;
    let isHigh = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && bars[j]!.high >= price) {
        isHigh = false;
        break;
      }
    }
    if (isHigh) result.push({ index: i, price });
  }
  return result;
}

function findSwingLows(bars: OHLCVBar[], lookback = 4): SwingPoint[] {
  const result: SwingPoint[] = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    const price = bars[i]!.low;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && bars[j]!.low <= price) {
        isLow = false;
        break;
      }
    }
    if (isLow) result.push({ index: i, price });
  }
  return result;
}

function withinPct(a: number, b: number, pct: number): boolean {
  return Math.abs(a - b) / Math.max(a, b) < pct / 100;
}

function detectDoubleTop(bars: OHLCVBar[], swingHighs: SwingPoint[]): DetectedPattern | null {
  const recent = swingHighs.filter(h => h.index >= bars.length - 60);
  if (recent.length < 2) return null;

  for (let i = recent.length - 1; i >= 1; i--) {
    const h2 = recent[i]!;
    const h1 = recent[i - 1]!;
    const barGap = h2.index - h1.index;

    if (barGap < 5 || barGap > 50) continue;
    if (!withinPct(h1.price, h2.price, 2.5)) continue;

    const valleySlice = bars.slice(h1.index, h2.index);
    const valleyLow = Math.min(...valleySlice.map(b => b.low));
    const neckline = valleyLow;
    const currentPrice = bars[bars.length - 1]!.close;

    if (currentPrice < neckline) {
      return {
        type: "double-top",
        direction: "bearish",
        confidence: 80,
        description: `Double top at $${h1.price.toFixed(2)}–$${h2.price.toFixed(2)}. Neckline broken at $${neckline.toFixed(2)}. Pattern complete — bearish reversal confirmed.`,
        keyLevel: neckline,
      };
    }

    const pctFromNeckline = (currentPrice - neckline) / neckline * 100;
    if (pctFromNeckline < 5) {
      return {
        type: "double-top",
        direction: "bearish",
        confidence: 65,
        description: `Double top forming at $${h1.price.toFixed(2)}–$${h2.price.toFixed(2)}. Neckline at $${neckline.toFixed(2)} is ${pctFromNeckline.toFixed(1)}% above current price. Break below confirms pattern.`,
        keyLevel: neckline,
      };
    }
  }
  return null;
}

function detectDoubleBottom(bars: OHLCVBar[], swingLows: SwingPoint[]): DetectedPattern | null {
  const recent = swingLows.filter(l => l.index >= bars.length - 60);
  if (recent.length < 2) return null;

  for (let i = recent.length - 1; i >= 1; i--) {
    const l2 = recent[i]!;
    const l1 = recent[i - 1]!;
    const barGap = l2.index - l1.index;

    if (barGap < 5 || barGap > 50) continue;
    if (!withinPct(l1.price, l2.price, 2.5)) continue;

    const peakSlice = bars.slice(l1.index, l2.index);
    const peakHigh = Math.max(...peakSlice.map(b => b.high));
    const neckline = peakHigh;
    const currentPrice = bars[bars.length - 1]!.close;

    if (currentPrice > neckline) {
      return {
        type: "double-bottom",
        direction: "bullish",
        confidence: 80,
        description: `Double bottom at $${l1.price.toFixed(2)}–$${l2.price.toFixed(2)}. Neckline broken above $${neckline.toFixed(2)}. Pattern complete — bullish reversal confirmed.`,
        keyLevel: neckline,
      };
    }

    const pctFromNeckline = (neckline - currentPrice) / currentPrice * 100;
    if (pctFromNeckline < 5) {
      return {
        type: "double-bottom",
        direction: "bullish",
        confidence: 65,
        description: `Double bottom forming at $${l1.price.toFixed(2)}–$${l2.price.toFixed(2)}. Neckline at $${neckline.toFixed(2)} is ${pctFromNeckline.toFixed(1)}% above current price. Break above confirms pattern.`,
        keyLevel: neckline,
      };
    }
  }
  return null;
}

function detectHeadAndShoulders(bars: OHLCVBar[], swingHighs: SwingPoint[]): DetectedPattern | null {
  const recent = swingHighs.filter(h => h.index >= bars.length - 80);
  if (recent.length < 3) return null;

  for (let i = recent.length - 1; i >= 2; i--) {
    const rShoulder = recent[i]!;
    const head = recent[i - 1]!;
    const lShoulder = recent[i - 2]!;

    if (head.price <= lShoulder.price || head.price <= rShoulder.price) continue;
    if (!withinPct(lShoulder.price, rShoulder.price, 5)) continue;

    const necklineEstimate = Math.min(
      Math.min(...bars.slice(lShoulder.index, head.index).map(b => b.low)),
      Math.min(...bars.slice(head.index, rShoulder.index).map(b => b.low))
    );
    const currentPrice = bars[bars.length - 1]!.close;

    return {
      type: "head-and-shoulders",
      direction: "bearish",
      confidence: currentPrice < necklineEstimate ? 85 : 60,
      description: `Head & shoulders: shoulders at $${lShoulder.price.toFixed(2)}/$${rShoulder.price.toFixed(2)}, head at $${head.price.toFixed(2)}. Neckline ~$${necklineEstimate.toFixed(2)}. ${currentPrice < necklineEstimate ? "Neckline broken — bearish reversal active." : "Watching for neckline break."}`,
      keyLevel: necklineEstimate,
    };
  }
  return null;
}

function detectInverseHeadAndShoulders(bars: OHLCVBar[], swingLows: SwingPoint[]): DetectedPattern | null {
  const recent = swingLows.filter(l => l.index >= bars.length - 80);
  if (recent.length < 3) return null;

  for (let i = recent.length - 1; i >= 2; i--) {
    const rShoulder = recent[i]!;
    const head = recent[i - 1]!;
    const lShoulder = recent[i - 2]!;

    if (head.price >= lShoulder.price || head.price >= rShoulder.price) continue;
    if (!withinPct(lShoulder.price, rShoulder.price, 5)) continue;

    const necklineEstimate = Math.max(
      Math.max(...bars.slice(lShoulder.index, head.index).map(b => b.high)),
      Math.max(...bars.slice(head.index, rShoulder.index).map(b => b.high))
    );
    const currentPrice = bars[bars.length - 1]!.close;

    return {
      type: "inverse-head-and-shoulders",
      direction: "bullish",
      confidence: currentPrice > necklineEstimate ? 85 : 60,
      description: `Inverse H&S: shoulders at $${lShoulder.price.toFixed(2)}/$${rShoulder.price.toFixed(2)}, head at $${head.price.toFixed(2)}. Neckline ~$${necklineEstimate.toFixed(2)}. ${currentPrice > necklineEstimate ? "Neckline broken — bullish reversal active." : "Watching for breakout above neckline."}`,
      keyLevel: necklineEstimate,
    };
  }
  return null;
}

function detectFlag(bars: OHLCVBar[]): DetectedPattern | null {
  if (bars.length < 15) return null;

  const poleBars = bars.slice(-15, -5);
  const flagBars = bars.slice(-5);

  const poleStart = poleBars[0]!.close;
  const poleEnd = poleBars[poleBars.length - 1]!.close;
  const poleMovePercent = (poleEnd - poleStart) / poleStart * 100;

  const flagHigh = Math.max(...flagBars.map(b => b.high));
  const flagLow = Math.min(...flagBars.map(b => b.low));
  const flagRange = (flagHigh - flagLow) / flagLow * 100;
  const flagReturn = (flagBars[flagBars.length - 1]!.close - flagBars[0]!.close) / flagBars[0]!.close * 100;

  if (poleMovePercent > 4 && flagRange < 3 && Math.abs(flagReturn) < 2) {
    if (flagReturn <= 0 || flagReturn < poleMovePercent / 3) {
      return {
        type: "bullish-flag",
        direction: "bullish",
        confidence: 70,
        description: `Bullish flag: pole up ${poleMovePercent.toFixed(1)}% in 10 bars, tight ${flagRange.toFixed(1)}% consolidation over 5 bars. Continuation signal — watch for breakout above $${flagHigh.toFixed(2)}.`,
        keyLevel: flagHigh,
      };
    }
  }

  if (poleMovePercent < -4 && flagRange < 3 && Math.abs(flagReturn) < 2) {
    if (flagReturn >= 0 || flagReturn > poleMovePercent / 3) {
      return {
        type: "bearish-flag",
        direction: "bearish",
        confidence: 70,
        description: `Bearish flag: pole down ${Math.abs(poleMovePercent).toFixed(1)}% in 10 bars, tight ${flagRange.toFixed(1)}% consolidation over 5 bars. Continuation signal — watch for break below $${flagLow.toFixed(2)}.`,
        keyLevel: flagLow,
      };
    }
  }

  return null;
}

function detectMovingAverageCross(bars: OHLCVBar[]): DetectedPattern | null {
  if (bars.length < 210) return null;

  const closes = bars.map(b => b.close);
  const sma50Series: number[] = [];
  const sma200Series: number[] = [];

  for (let i = bars.length - 25; i < bars.length; i++) {
    if (i >= 50) sma50Series.push(closes.slice(i - 50, i).reduce((a, b) => a + b, 0) / 50);
    if (i >= 200) sma200Series.push(closes.slice(i - 200, i).reduce((a, b) => a + b, 0) / 200);
  }

  if (sma50Series.length < 2 || sma200Series.length < 2) return null;

  const prevDiff = sma50Series[sma50Series.length - 2]! - sma200Series[sma200Series.length - 2]!;
  const currDiff = sma50Series[sma50Series.length - 1]! - sma200Series[sma200Series.length - 1]!;

  if (prevDiff < 0 && currDiff > 0) {
    return {
      type: "golden-cross",
      direction: "bullish",
      confidence: 75,
      description: `Golden cross: 50-day SMA ($${sma50Series[sma50Series.length - 1]!.toFixed(2)}) crossed above 200-day SMA ($${sma200Series[sma200Series.length - 1]!.toFixed(2)}). Classic trend change confirmation — institutional buying signal.`,
    };
  }

  if (prevDiff > 0 && currDiff < 0) {
    return {
      type: "death-cross",
      direction: "bearish",
      confidence: 75,
      description: `Death cross: 50-day SMA ($${sma50Series[sma50Series.length - 1]!.toFixed(2)}) crossed below 200-day SMA ($${sma200Series[sma200Series.length - 1]!.toFixed(2)}). Trend reversal warning — potential prolonged downtrend.`,
    };
  }

  return null;
}

function computeSupportResistance(bars: OHLCVBar[], swingHighs: SwingPoint[], swingLows: SwingPoint[]): SupportResistanceLevels {
  const currentPrice = bars[bars.length - 1]!.close;
  const lastBar = bars[bars.length - 1]!;
  const prevBar = bars[bars.length - 2];

  const CLUSTER_PCT = 1.5;

  function clusterLevels(points: number[]): number[] {
    if (!points.length) return [];
    const sorted = [...points].sort((a, b) => a - b);
    const clusters: number[][] = [];

    for (const p of sorted) {
      const existing = clusters.find(c => c.some(v => withinPct(v, p, CLUSTER_PCT)));
      if (existing) existing.push(p);
      else clusters.push([p]);
    }

    return clusters
      .filter(c => c.length >= 2)
      .map(c => Math.round((c.reduce((a, b) => a + b, 0) / c.length) * 100) / 100)
      .sort((a, b) => a - b);
  }

  const recentHighs = swingHighs.slice(-20).map(h => h.price);
  const recentLows = swingLows.slice(-20).map(l => l.price);

  const resistances = clusterLevels(recentHighs).filter(r => r > currentPrice);
  const supports = clusterLevels(recentLows).filter(s => s < currentPrice);

  const nearestResistance = resistances.length > 0 ? resistances[0]! : null;
  const nearestSupport = supports.length > 0 ? supports[supports.length - 1]! : null;

  const pivotHigh = prevBar ? Math.max(lastBar.high, prevBar.high) : lastBar.high;
  const pivotLow = prevBar ? Math.min(lastBar.low, prevBar.low) : lastBar.low;
  const pivotClose = lastBar.close;

  const pp = Math.round(((pivotHigh + pivotLow + pivotClose) / 3) * 100) / 100;
  const r1 = Math.round((2 * pp - pivotLow) * 100) / 100;
  const r2 = Math.round((pp + (pivotHigh - pivotLow)) * 100) / 100;
  const s1 = Math.round((2 * pp - pivotHigh) * 100) / 100;
  const s2 = Math.round((pp - (pivotHigh - pivotLow)) * 100) / 100;

  return {
    supports: supports.slice(-3),
    resistances: resistances.slice(0, 3),
    nearestSupport,
    nearestResistance,
    pivotPoint: pp,
    r1, r2, s1, s2,
  };
}

function detectRSIDivergence(bars: OHLCVBar[], rsiSeries: number[]): RSIDivergence {
  const minLen = 20;
  if (bars.length < minLen || rsiSeries.length < 10) {
    return { type: null, strength: null, description: null };
  }

  const lookback = Math.min(20, bars.length, rsiSeries.length);
  const recentBars = bars.slice(-lookback);
  const recentRSI = rsiSeries.slice(-lookback);

  const midpoint = Math.floor(lookback / 2);
  const firstHalfHigh = Math.max(...recentBars.slice(0, midpoint).map(b => b.high));
  const secondHalfHigh = Math.max(...recentBars.slice(midpoint).map(b => b.high));
  const firstHalfLow = Math.min(...recentBars.slice(0, midpoint).map(b => b.low));
  const secondHalfLow = Math.min(...recentBars.slice(midpoint).map(b => b.low));

  const firstHalfRSIHigh = Math.max(...recentRSI.slice(0, midpoint));
  const secondHalfRSIHigh = Math.max(...recentRSI.slice(midpoint));
  const firstHalfRSILow = Math.min(...recentRSI.slice(0, midpoint));
  const secondHalfRSILow = Math.min(...recentRSI.slice(midpoint));

  const priceHigherHigh = secondHalfHigh > firstHalfHigh * 1.005;
  const rsiLowerHigh = secondHalfRSIHigh < firstHalfRSIHigh - 3;
  const priceLowerLow = secondHalfLow < firstHalfLow * 0.995;
  const rsiHigherLow = secondHalfRSILow > firstHalfRSILow + 3;

  if (priceHigherHigh && rsiLowerHigh) {
    const isStrong = secondHalfRSIHigh < firstHalfRSIHigh - 8;
    return {
      type: "bearish",
      strength: isStrong ? "strong" : "moderate",
      description: `Bearish RSI divergence: price made a higher high ($${secondHalfHigh.toFixed(2)} vs $${firstHalfHigh.toFixed(2)}) but RSI peaked lower (${secondHalfRSIHigh.toFixed(0)} vs ${firstHalfRSIHigh.toFixed(0)}). ${isStrong ? "Strong signal — momentum failing, reversal risk elevated." : "Moderate signal — weakening upside momentum."}`,
    };
  }

  if (priceLowerLow && rsiHigherLow) {
    const isStrong = secondHalfRSILow > firstHalfRSILow + 8;
    return {
      type: "bullish",
      strength: isStrong ? "strong" : "moderate",
      description: `Bullish RSI divergence: price made a lower low ($${secondHalfLow.toFixed(2)} vs $${firstHalfLow.toFixed(2)}) but RSI held higher (${secondHalfRSILow.toFixed(0)} vs ${firstHalfRSILow.toFixed(0)}). ${isStrong ? "Strong signal — selling pressure exhausted, reversal setup." : "Moderate signal — downside momentum fading."}`,
    };
  }

  return { type: null, strength: null, description: null };
}

export function analyzePatterns(bars: OHLCVBar[], rsiSeries: number[] = []): PatternAnalysis {
  if (bars.length < 30) {
    return {
      patterns: [],
      divergence: { type: null, strength: null, description: null },
      levels: { supports: [], resistances: [], nearestSupport: null, nearestResistance: null, pivotPoint: null, r1: null, r2: null, s1: null, s2: null },
      confluence: { bullishCount: 0, bearishCount: 0, dominantBias: "neutral", score: 0 },
    };
  }

  const swingHighs = findSwingHighs(bars);
  const swingLows = findSwingLows(bars);

  const patterns: DetectedPattern[] = [];

  const doubleTop = detectDoubleTop(bars, swingHighs);
  if (doubleTop) patterns.push(doubleTop);

  const doubleBottom = detectDoubleBottom(bars, swingLows);
  if (doubleBottom) patterns.push(doubleBottom);

  const hAndS = detectHeadAndShoulders(bars, swingHighs);
  if (hAndS) patterns.push(hAndS);

  const iHAndS = detectInverseHeadAndShoulders(bars, swingLows);
  if (iHAndS) patterns.push(iHAndS);

  const flag = detectFlag(bars);
  if (flag) patterns.push(flag);

  const maCross = detectMovingAverageCross(bars);
  if (maCross) patterns.push(maCross);

  const divergence = detectRSIDivergence(bars, rsiSeries);
  const levels = computeSupportResistance(bars, swingHighs, swingLows);

  let bullishCount = patterns.filter(p => p.direction === "bullish").length;
  let bearishCount = patterns.filter(p => p.direction === "bearish").length;

  if (divergence.type === "bullish") bullishCount++;
  if (divergence.type === "bearish") bearishCount++;

  const score = (bullishCount - bearishCount) * 2;

  return {
    patterns,
    divergence,
    levels,
    confluence: {
      bullishCount,
      bearishCount,
      dominantBias: bullishCount > bearishCount ? "bullish" : bearishCount > bullishCount ? "bearish" : "neutral",
      score,
    },
  };
}

export function interpretPatterns(analysis: PatternAnalysis, currentPrice: number): string {
  const lines: string[] = [];

  for (const p of analysis.patterns) {
    lines.push(`[${p.direction.toUpperCase()} PATTERN — ${p.confidence}% confidence] ${p.description}`);
  }

  if (analysis.divergence.description) {
    lines.push(`[RSI DIVERGENCE — ${analysis.divergence.strength?.toUpperCase()}] ${analysis.divergence.description}`);
  }

  const { nearestSupport, nearestResistance, pivotPoint } = analysis.levels;
  if (nearestSupport) {
    const distPct = ((currentPrice - nearestSupport) / currentPrice * 100).toFixed(1);
    lines.push(`Nearest support: $${nearestSupport} (${distPct}% below current price)`);
  }
  if (nearestResistance) {
    const distPct = ((nearestResistance - currentPrice) / currentPrice * 100).toFixed(1);
    lines.push(`Nearest resistance: $${nearestResistance} (${distPct}% above current price)`);
  }
  if (pivotPoint) {
    lines.push(`Daily pivot: $${pivotPoint} | R1: $${analysis.levels.r1} | R2: $${analysis.levels.r2} | S1: $${analysis.levels.s1} | S2: $${analysis.levels.s2}`);
  }

  if (analysis.confluence.dominantBias !== "neutral") {
    lines.push(`Pattern confluence: ${analysis.confluence.bullishCount} bullish vs ${analysis.confluence.bearishCount} bearish signals → ${analysis.confluence.dominantBias.toUpperCase()} bias`);
  }

  return lines.join(". ");
}
