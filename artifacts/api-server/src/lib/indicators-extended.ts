import {
  IchimokuCloud,
  Stochastic,
  WilliamsR,
  CCI,
  PSAR,
  ADX,
  OBV,
} from "technicalindicators";
import type { OHLCVBar } from "./technicals";

export interface ExtendedIndicators {
  ichimoku: {
    tenkan: number | null;
    kijun: number | null;
    senkouA: number | null;
    senkouB: number | null;
    chikou: number | null;
    cloudTop: number | null;
    cloudBottom: number | null;
    aboveCloud: boolean | null;
  } | null;
  stochastic: {
    k: number | null;
    d: number | null;
  } | null;
  williamsR: number | null;
  cci: number | null;
  parabolicSAR: number | null;
  adx: {
    adx: number | null;
    pdi: number | null;
    mdi: number | null;
    trendStrength: "strong" | "moderate" | "weak" | null;
  } | null;
  obv: number | null;
  obvTrend: "rising" | "falling" | "flat" | null;
}

export function computeExtendedIndicators(bars: OHLCVBar[]): ExtendedIndicators {
  const empty: ExtendedIndicators = {
    ichimoku: null,
    stochastic: null,
    williamsR: null,
    cci: null,
    parabolicSAR: null,
    adx: null,
    obv: null,
    obvTrend: null,
  };

  if (bars.length < 30) return empty;

  const closes = bars.map(b => b.close);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const volumes = bars.map(b => b.volume);
  const currentPrice = closes[closes.length - 1]!;

  let ichimoku: ExtendedIndicators["ichimoku"] = null;
  try {
    if (bars.length >= 52) {
      const ichimokuInput = {
        high: highs,
        low: lows,
        conversionPeriod: 9,
        basePeriod: 26,
        simpleCloudConversionPeriod: 52,
        displacement: 26,
      };
      const result = IchimokuCloud.calculate(ichimokuInput);
      const last = result[result.length - 1];
      if (last) {
        const cloudTop = Math.max(last.spanA ?? 0, last.spanB ?? 0);
        const cloudBottom = Math.min(last.spanA ?? 0, last.spanB ?? 0);
        ichimoku = {
          tenkan: last.conversion !== undefined ? Math.round(last.conversion * 100) / 100 : null,
          kijun: last.base !== undefined ? Math.round(last.base * 100) / 100 : null,
          senkouA: last.spanA !== undefined ? Math.round(last.spanA * 100) / 100 : null,
          senkouB: last.spanB !== undefined ? Math.round(last.spanB * 100) / 100 : null,
          chikou: closes[closes.length - 26] !== undefined ? Math.round(closes[closes.length - 26]! * 100) / 100 : null,
          cloudTop: Math.round(cloudTop * 100) / 100,
          cloudBottom: Math.round(cloudBottom * 100) / 100,
          aboveCloud: cloudTop > 0 ? currentPrice > cloudTop : null,
        };
      }
    }
  } catch { }

  let stochastic: ExtendedIndicators["stochastic"] = null;
  try {
    const stochResult = Stochastic.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14,
      signalPeriod: 3,
    });
    const last = stochResult[stochResult.length - 1];
    if (last) {
      stochastic = {
        k: Math.round(last.k * 10) / 10,
        d: Math.round(last.d * 10) / 10,
      };
    }
  } catch { }

  let williamsR: number | null = null;
  try {
    const wrResult = WilliamsR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14,
    });
    const last = wrResult[wrResult.length - 1];
    if (last !== undefined) {
      williamsR = Math.round(last * 10) / 10;
    }
  } catch { }

  let cci: number | null = null;
  try {
    const cciResult = CCI.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 20,
    });
    const last = cciResult[cciResult.length - 1];
    if (last !== undefined) {
      cci = Math.round(last * 10) / 10;
    }
  } catch { }

  let parabolicSAR: number | null = null;
  try {
    const psarResult = PSAR.calculate({
      high: highs,
      low: lows,
      step: 0.02,
      max: 0.2,
    });
    const last = psarResult[psarResult.length - 1];
    if (last !== undefined) {
      parabolicSAR = Math.round(last * 100) / 100;
    }
  } catch { }

  let adx: ExtendedIndicators["adx"] = null;
  try {
    if (bars.length >= 28) {
      const adxResult = ADX.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 14,
      });
      const last = adxResult[adxResult.length - 1];
      if (last) {
        const adxVal = Math.round(last.adx * 10) / 10;
        adx = {
          adx: adxVal,
          pdi: Math.round(last.pdi * 10) / 10,
          mdi: Math.round(last.mdi * 10) / 10,
          trendStrength: adxVal >= 25 ? "strong" : adxVal >= 15 ? "moderate" : "weak",
        };
      }
    }
  } catch { }

  let obv: number | null = null;
  let obvTrend: ExtendedIndicators["obvTrend"] = null;
  try {
    const obvResult = OBV.calculate({
      close: closes,
      volume: volumes,
    });
    const lastObv = obvResult[obvResult.length - 1];
    if (lastObv !== undefined) {
      obv = Math.round(lastObv);
      if (obvResult.length >= 10) {
        const recent = obvResult[obvResult.length - 1]!;
        const earlier = obvResult[obvResult.length - 10]!;
        const diff = recent - earlier;
        const pct = earlier !== 0 ? Math.abs(diff / earlier) : 0;
        if (pct < 0.005) obvTrend = "flat";
        else obvTrend = diff > 0 ? "rising" : "falling";
      }
    }
  } catch { }

  return { ichimoku, stochastic, williamsR, cci, parabolicSAR, adx, obv, obvTrend };
}

export function interpretExtendedIndicators(ext: ExtendedIndicators, currentPrice: number): string {
  const lines: string[] = [];

  if (ext.ichimoku) {
    const { tenkan, kijun, cloudTop, cloudBottom, aboveCloud } = ext.ichimoku;
    if (aboveCloud !== null) {
      lines.push(`Ichimoku: price ${aboveCloud ? "above" : "below"} cloud ($${cloudBottom}–$${cloudTop}) — ${aboveCloud ? "bullish bias" : "bearish bias"}`);
    }
    if (tenkan !== null && kijun !== null) {
      lines.push(`Tenkan ($${tenkan}) ${tenkan > kijun ? "above" : "below"} Kijun ($${kijun}) — ${tenkan > kijun ? "bullish TK cross" : "bearish TK cross"}`);
    }
  }

  if (ext.stochastic?.k !== null && ext.stochastic?.d !== null) {
    const { k, d } = ext.stochastic!;
    if (k! >= 80) lines.push(`Stochastic %K at ${k} — overbought zone, watch for bearish crossover`);
    else if (k! <= 20) lines.push(`Stochastic %K at ${k} — oversold zone, watch for bullish crossover`);
    else lines.push(`Stochastic %K/${k} %D/${d} — ${k! > d! ? "bullish momentum" : "bearish momentum"}, mid-range`);
  }

  if (ext.williamsR !== null) {
    const wr = ext.williamsR;
    if (wr >= -20) lines.push(`Williams %R at ${wr} — overbought (near 0), potential reversal zone`);
    else if (wr <= -80) lines.push(`Williams %R at ${wr} — oversold (near -100), potential bounce zone`);
    else lines.push(`Williams %R at ${wr} — neutral range`);
  }

  if (ext.cci !== null) {
    const c = ext.cci;
    if (c >= 100) lines.push(`CCI at ${c} — overbought, trend may be overextended`);
    else if (c <= -100) lines.push(`CCI at ${c} — oversold, potential reversal signal`);
    else lines.push(`CCI at ${c} — within normal range (±100)`);
  }

  if (ext.parabolicSAR !== null) {
    const sar = ext.parabolicSAR;
    const bullish = currentPrice > sar;
    lines.push(`Parabolic SAR at $${sar} — price ${bullish ? "above" : "below"} SAR (${bullish ? "uptrend, trail stop" : "downtrend, stop loss"})`);
  }

  if (ext.adx) {
    const { adx, pdi, mdi, trendStrength } = ext.adx;
    lines.push(`ADX at ${adx} (${trendStrength} trend) — +DI ${pdi} vs -DI ${mdi} (${pdi! > mdi! ? "bullish directional bias" : "bearish directional bias"})`);
  }

  if (ext.obv !== null && ext.obvTrend !== null) {
    const obvK = ext.obv >= 1_000_000 ? `${(ext.obv / 1_000_000).toFixed(1)}M` : ext.obv >= 1_000 ? `${(ext.obv / 1_000).toFixed(0)}K` : `${ext.obv}`;
    lines.push(`OBV at ${obvK} — ${ext.obvTrend} trend (${ext.obvTrend === "rising" ? "accumulation, bullish" : ext.obvTrend === "falling" ? "distribution, bearish" : "neutral volume trend"})`);
  }

  return lines.join(". ");
}
