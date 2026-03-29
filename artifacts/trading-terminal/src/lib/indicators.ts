import type { LineData } from "lightweight-charts";

export interface OhlcBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface IchimokuResult {
  tenkan: LineData[];
  kijun: LineData[];
  senkouA: LineData[];
  senkouB: LineData[];
  chikou: LineData[];
}

export interface StochasticResult {
  k: LineData[];
  d: LineData[];
}

function smaSeries(arr: number[], p: number): number[] {
  const result: number[] = [];
  for (let i = p - 1; i < arr.length; i++) {
    const s = arr.slice(i - p + 1, i + 1);
    result.push(s.reduce((a, b) => a + b, 0) / p);
  }
  return result;
}

export function computeIchimoku(sorted: OhlcBar[]): IchimokuResult {
  const tenkanPeriod = 9;
  const kijunPeriod = 26;
  const senkouBPeriod = 52;
  const displacement = 26;

  const tenkan: LineData[] = [];
  const kijun: LineData[] = [];
  const senkouA: LineData[] = [];
  const senkouB: LineData[] = [];
  const chikou: LineData[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const bar = sorted[i]!;

    if (i >= tenkanPeriod - 1) {
      const slice = sorted.slice(i - tenkanPeriod + 1, i + 1);
      const hi = Math.max(...slice.map(b => b.high));
      const lo = Math.min(...slice.map(b => b.low));
      tenkan.push({ time: bar.time as unknown as LineData["time"], value: Math.round(((hi + lo) / 2) * 100) / 100 });
    }

    if (i >= kijunPeriod - 1) {
      const slice = sorted.slice(i - kijunPeriod + 1, i + 1);
      const hi = Math.max(...slice.map(b => b.high));
      const lo = Math.min(...slice.map(b => b.low));
      kijun.push({ time: bar.time as unknown as LineData["time"], value: Math.round(((hi + lo) / 2) * 100) / 100 });
    }

    const dispIndex = i - displacement;
    if (dispIndex >= tenkanPeriod - 1 && dispIndex >= kijunPeriod - 1) {
      const tSlice = sorted.slice(dispIndex - tenkanPeriod + 1, dispIndex + 1);
      const kSlice = sorted.slice(dispIndex - kijunPeriod + 1, dispIndex + 1);
      const tHi = Math.max(...tSlice.map(b => b.high));
      const tLo = Math.min(...tSlice.map(b => b.low));
      const kHi = Math.max(...kSlice.map(b => b.high));
      const kLo = Math.min(...kSlice.map(b => b.low));
      const tVal = (tHi + tLo) / 2;
      const kVal = (kHi + kLo) / 2;
      senkouA.push({ time: bar.time as unknown as LineData["time"], value: Math.round(((tVal + kVal) / 2) * 100) / 100 });
    }

    if (dispIndex >= senkouBPeriod - 1) {
      const slice = sorted.slice(dispIndex - senkouBPeriod + 1, dispIndex + 1);
      const hi = Math.max(...slice.map(b => b.high));
      const lo = Math.min(...slice.map(b => b.low));
      senkouB.push({ time: bar.time as unknown as LineData["time"], value: Math.round(((hi + lo) / 2) * 100) / 100 });
    }

    if (i + displacement < sorted.length) {
      chikou.push({ time: sorted[i + displacement]!.time as unknown as LineData["time"], value: Math.round(bar.close * 100) / 100 });
    }
  }

  return { tenkan, kijun, senkouA, senkouB, chikou };
}

export function computeStochastic(sorted: OhlcBar[], period = 14, smoothK = 3, smoothD = 3): StochasticResult {
  const rawK: number[] = [];
  for (let i = period - 1; i < sorted.length; i++) {
    const slice = sorted.slice(i - period + 1, i + 1);
    const hi = Math.max(...slice.map(b => b.high));
    const lo = Math.min(...slice.map(b => b.low));
    const close = sorted[i]!.close;
    rawK.push(hi !== lo ? ((close - lo) / (hi - lo)) * 100 : 50);
  }

  const kLine = smaSeries(rawK, smoothK);
  const dLine = smaSeries(kLine, smoothD);

  const offset = period - 1 + smoothK - 1;
  const kData: LineData[] = kLine.map((v, i) => ({
    time: sorted[i + offset]!.time as unknown as LineData["time"],
    value: Math.round(v * 10) / 10,
  }));
  const dOffset = offset + smoothD - 1;
  const dData: LineData[] = dLine.map((v, i) => ({
    time: sorted[i + dOffset]!.time as unknown as LineData["time"],
    value: Math.round(v * 10) / 10,
  }));

  return { k: kData, d: dData };
}

export function computeSMA(sorted: OhlcBar[], period: number): LineData[] {
  if (sorted.length < period) return [];
  const result: LineData[] = [];
  for (let i = period - 1; i < sorted.length; i++) {
    const slice = sorted.slice(i - period + 1, i + 1);
    const avg = slice.reduce((s, b) => s + b.close, 0) / period;
    result.push({ time: sorted[i]!.time as unknown as LineData["time"], value: Math.round(avg * 100) / 100 });
  }
  return result;
}

export function computeEMA(sorted: OhlcBar[], period: number): LineData[] {
  if (sorted.length < period) return [];
  const k = 2 / (period + 1);
  let ema = sorted.slice(0, period).reduce((s, b) => s + b.close, 0) / period;
  const result: LineData[] = [{ time: sorted[period - 1]!.time as unknown as LineData["time"], value: Math.round(ema * 100) / 100 }];
  for (let i = period; i < sorted.length; i++) {
    ema = sorted[i]!.close * k + ema * (1 - k);
    result.push({ time: sorted[i]!.time as unknown as LineData["time"], value: Math.round(ema * 100) / 100 });
  }
  return result;
}

export interface BollingerResult {
  upper: LineData[];
  middle: LineData[];
  lower: LineData[];
}

export function computeBollinger(sorted: OhlcBar[], period = 20, stddevMult = 2): BollingerResult {
  if (sorted.length < period) return { upper: [], middle: [], lower: [] };
  const upper: LineData[] = [];
  const middle: LineData[] = [];
  const lower: LineData[] = [];
  for (let i = period - 1; i < sorted.length; i++) {
    const slice = sorted.slice(i - period + 1, i + 1);
    const closes = slice.map(b => b.close);
    const avg = closes.reduce((s, v) => s + v, 0) / period;
    const variance = closes.reduce((s, v) => s + (v - avg) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    const t = sorted[i]!.time as unknown as LineData["time"];
    middle.push({ time: t, value: Math.round(avg * 100) / 100 });
    upper.push({ time: t, value: Math.round((avg + stddevMult * sd) * 100) / 100 });
    lower.push({ time: t, value: Math.round((avg - stddevMult * sd) * 100) / 100 });
  }
  return { upper, middle, lower };
}

export function computeRSI(sorted: OhlcBar[], period = 14): LineData[] {
  if (sorted.length < period + 1) return [];
  const result: LineData[] = [];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = sorted[i]!.close - sorted[i - 1]!.close;
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;
  const first = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  result.push({ time: sorted[period]!.time as unknown as LineData["time"], value: Math.round(first * 10) / 10 });
  for (let i = period + 1; i < sorted.length; i++) {
    const diff = sorted[i]!.close - sorted[i - 1]!.close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push({ time: sorted[i]!.time as unknown as LineData["time"], value: Math.round(rsi * 10) / 10 });
  }
  return result;
}

export function computePSAR(sorted: OhlcBar[], step = 0.02, maxAF = 0.2): LineData[] {
  if (sorted.length < 2) return [];
  const result: LineData[] = [];
  let bull = true;
  let af = step;
  let ep = sorted[0]!.high;
  let sar = sorted[0]!.low;

  for (let i = 1; i < sorted.length; i++) {
    const bar = sorted[i]!;
    const prevBar = sorted[i - 1]!;

    sar = sar + af * (ep - sar);

    if (bull) {
      sar = Math.min(sar, prevBar.low, i >= 2 ? sorted[i - 2]!.low : prevBar.low);
      if (bar.low < sar) {
        bull = false;
        sar = ep;
        ep = bar.low;
        af = step;
      } else {
        if (bar.high > ep) {
          ep = bar.high;
          af = Math.min(af + step, maxAF);
        }
      }
    } else {
      sar = Math.max(sar, prevBar.high, i >= 2 ? sorted[i - 2]!.high : prevBar.high);
      if (bar.high > sar) {
        bull = true;
        sar = ep;
        ep = bar.high;
        af = step;
      } else {
        if (bar.low < ep) {
          ep = bar.low;
          af = Math.min(af + step, maxAF);
        }
      }
    }

    result.push({ time: bar.time as unknown as LineData["time"], value: Math.round(sar * 100) / 100 });
  }

  return result;
}
